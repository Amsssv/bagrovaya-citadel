import type { Board, Position } from '@/entities/board';
import { canOpenPotion, canSwap, findMatches, findMerges, swap } from '@/entities/board';
import type { Nests } from '@/entities/citadel';
import { canPushToNest } from '@/entities/citadel';
import type { RunStats } from '@/entities/player';
import { computeScore } from '@/entities/player';
import type { ScoreWeights } from '@/entities/player';
import type { Rng } from '@/shared/lib/rng';

import type { BotProfile } from './botProfile';
import type { RunOptions, RunState } from './run';
import { isRunOver, runDawn, stepInTwilight } from './run';
import type { PlayerMove } from './twilight';
import { canPlay } from './twilight';

/**
 * Бот для массового прогона.
 *
 * Считает он грубо: ход оценивается **до** разрешения поля — свап плюс поиск
 * троек и слияний, без гравитации и досыпки. Полное разрешение на каждого из
 * шести десятков кандидатов сделало бы десять тысяч забегов недосчитываемыми,
 * а для эвристики этого и не нужно.
 *
 * Случайность бота живёт в своём потоке: его решения не должны сдвигать ни
 * досыпку, ни состав волны.
 */
export interface BotRunResult {
  readonly nights: number;
  readonly stats: RunStats;
  readonly score: number;
  /** Чем кончилось: пала цитадель или упёрлись в предел прогона. */
  readonly outcome: 'fallen' | 'capped';
  /** Суммарная длительность боёв, миллисекунды игрового времени. */
  readonly battleMs: number;
}

export interface BotRun {
  readonly run: RunState;
  readonly options: RunOptions;
  readonly profile: BotProfile;
  readonly rng: Rng;
  readonly weights: ScoreWeights;
  readonly maxNights: number;
}

/**
 * Все соседние пары — **в обе стороны**. Направление важно: постройка встаёт на
 * клетке назначения (§6), поэтому «тащить левую вправо» и «тащить правую влево»
 * дают разный результат, и бот, знающий только одно из них, играет вслепую.
 */
function swapPairs(board: Board): [Position, Position][] {
  const pairs: [Position, Position][] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const here = { x, y };
      if (x + 1 < board.width) {
        const right = { x: x + 1, y };
        pairs.push([here, right], [right, here]);
      }
      if (y + 1 < board.height) {
        const below = { x, y: y + 1 };
        pairs.push([here, below], [below, here]);
      }
    }
  }
  return pairs;
}

/** Клетка не у края: горгулья там простреливает все восемь соседей (§7). */
function isInner(board: Board, at: Position): boolean {
  return at.x > 0 && at.y > 0 && at.x < board.width - 1 && at.y < board.height - 1;
}

/** Клетка, из которой горгулью ставят в башню замка. */
function underTurret(nests: Nests, at: Position): boolean {
  return nests.slots.some((slot) => slot.from.x === at.x && slot.from.y === at.y);
}

/** Первое законное вооружение башни, если оно есть. */
function findTurretMove(state: RunState): PlayerMove | null {
  for (const slot of state.nests.slots) {
    if (canPushToNest(state.board, state.nests, slot.from, slot.direction)) {
      return { type: 'nest', from: slot.from, direction: slot.direction };
    }
  }
  return null;
}

/** Грубая цена свапа: что он замкнёт, если его сделать. */
function valueOf(
  board: Board,
  nests: Nests,
  from: Position,
  to: Position,
  profile: BotProfile,
): number {
  const after = swap(board, from, to);
  const matches = findMatches(after);
  const merges = findMerges(after, [to, from]);

  let value = matches.length * profile.building + merges.length * profile.merge;
  // Тройка крови даёт потир, а он возвращает свапы — то есть продлевает забег.
  value += matches.filter((match) => match.resource === 'blood').length * profile.potion;
  // Постройка встаёт на клетке назначения, поэтому направление свапа важно.
  if (matches.length > 0 && isInner(board, to)) value += profile.centre;
  // Горгулья под башней замка следующим ходом уйдёт в башню.
  const stone = matches.some((match) => match.resource === 'stone');
  if (stone && underTurret(nests, to)) value += profile.turret;
  return value;
}

/** Первый потир на поле, если он есть. */
function findPotion(board: Board): Position | null {
  for (let index = 0; index < board.cells.length; index++) {
    const at = { x: index % board.width, y: Math.floor(index / board.width) };
    if (canOpenPotion(board, at)) return at;
  }
  return null;
}

export function chooseMove(
  state: RunState,
  options: RunOptions,
  profile: BotProfile,
  rng: Rng,
): PlayerMove | null {
  const twilight = {
    board: state.board,
    purse: state.purse,
    inventory: state.inventory,
    nests: state.nests,
  };

  // Горгулья под башней, и башня её примет — ставим: из башни она бьёт с
  // радиусом больше и по тем, кто уже у ворот.
  if (profile.turret > 0) {
    const armed = findTurretMove(state);
    if (armed !== null && canPlay(twilight, armed, options)) return armed;
  }

  // Запас на исходе — идём за потиром: без свапов забег кончится сам собой.
  if (state.purse.swaps <= profile.openPotionBelow) {
    const at = findPotion(state.board);
    if (at !== null) {
      const move: PlayerMove = { type: 'open', at };
      if (canPlay(twilight, move, options)) return move;
    }
  }

  const legal = swapPairs(state.board).filter(([from, to]) => canSwap(state.board, from, to));
  if (legal.length === 0) return null;

  if (rng.next() < profile.randomness) {
    const [from, to] = rng.pick(legal);
    return { type: 'swap', from, to };
  }

  let best = legal[0] as [Position, Position];
  let bestValue = 0;
  for (const [from, to] of legal) {
    const value = valueOf(state.board, state.nests, from, to, profile);
    if (value > bestValue) {
      bestValue = value;
      best = [from, to];
    }
  }

  // Ничего не замыкается — переставляем наугад. Иначе бот раз за разом выбирал
  // бы первый ход из списка и гонял одни и те же две клетки туда-сюда, проедая
  // запас впустую: так «умелый» играл хуже новичка.
  if (bestValue === 0) {
    const [from, to] = rng.pick(legal);
    return { type: 'swap', from, to };
  }

  return { type: 'swap', from: best[0], to: best[1] };
}

/** Один забег до падения цитадели или до предела прогона. */
export function playRun(setup: BotRun): BotRunResult {
  let state = setup.run;
  let battleMs = 0;

  while (!isRunOver(state) && state.night <= setup.maxNights) {
    for (let move = 0; move < setup.profile.movesPerNight; move++) {
      if (state.purse.swaps <= 0) break;
      // chooseMove возвращает только исполнимый ход, а запас проверен выше,
      // поэтому повторной проверки здесь нет: она была бы недостижимой.
      const chosen = chooseMove(state, setup.options, setup.profile, setup.rng);
      if (chosen === null) break;
      state = stepInTwilight(state, chosen, setup.options).run;
    }

    const report = runDawn(state, setup.options);
    battleMs += report.dawn.durationMs;
    state = report.after;
  }

  return {
    nights: state.stats.nights,
    stats: state.stats,
    score: computeScore(state.stats, setup.weights),
    outcome: isRunOver(state) ? 'fallen' : 'capped',
    battleMs,
  };
}
