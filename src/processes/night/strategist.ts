import type { Board, Cell, Position } from '@/entities/board';
import { canOpenPotion, canSwap, cellAt, findMatches, findMerges, swap } from '@/entities/board';
import type { BuildingBook, Tier } from '@/entities/building';
import { specFor, statsFor } from '@/entities/building';
import { canPushToNest } from '@/entities/citadel';
import { attackZone } from '@/entities/wave';
import { step } from '@/shared/lib/geometry';
import type { Rng } from '@/shared/lib/rng';
import { restoreRng } from '@/shared/lib/rng';

import type { RunOptions, RunState } from './run';
import { stepInTwilight } from './run';
import type { PlayerMove } from './twilight';
import { canPlay } from './twilight';

/**
 * Стратег — бот, который играет «как сильный игрок», а не для массовой
 * статистики, как `bot.ts`.
 *
 * Каждый законный ход он делает **на настоящем движке** — с гравитацией,
 * каскадами и досыпкой — и оценивает то, что получилось. Будущих плиток он не
 * знает, как и живой игрок: досыпка в его расчёте берётся из его собственного
 * потока случайности, а не из того, что на самом деле упадёт.
 *
 * Оценка поля (`evaluate`):
 *   • **оборона по столбцам** — враги идут по столбцам снизу вверх, и сколько
 *     урона столбец успеет нанести, зависит от того, сколько его клеток держат
 *     постройки и как часто те стреляют. Клетки — та же геометрия, что в бою
 *     (`attackZone`); завеса растягивает время в своей клетке. Считается и
 *     средний столбец, и самый слабый: колонна приходит в случайный;
 *   • **кровь про запас** — потиры по их объёму: слить три потира в больший
 *     выгоднее, чем выпить каждый;
 *   • **заготовки** — пары одинаковых плиток рядом: из них следующим ходом
 *     выйдет тройка.
 */
export interface StrategistWeights {
  /** Вес средней обороны столбца. */
  readonly meanColumn: number;
  /** Вес самого слабого столбца. */
  readonly weakColumn: number;
  /**
   * Цена потира на поле по ступеням — не его объём: Грубый (2 капли) стоит
   * дороже, потому что три Грубых сольются в Костяной на 12, а Костяные — в
   * Обсидиановый на 70. Пить выгодно, когда объём больше цены.
   */
  readonly potion: Readonly<Record<Tier, number>>;
  /** Цена капли крови, которую можно потратить этой ночью. */
  readonly purseBlood: number;
  /** Цена пары одинаковых сырых плиток рядом. */
  readonly pair: number;
  /** Цена хода, который следующим же свапом соберёт тройку. */
  readonly readyMatch: number;
  /** Цена хода, который следующим же свапом сольёт постройки или потиры. */
  readonly readyMerge: number;
  /** Цена свободной (сырой) клетки: на ней ещё вырастет постройка. */
  readonly freeCell: number;
  /** Цена пары одинаковых построек или потиров рядом — заготовки слияния. */
  readonly buildingPair: number;
  /** Вес столбца, откуда выйдет Проповедник, — в ночь босса. */
  readonly bossColumn: number;
  /**
   * Цена постройки по ступени — сверх её огня. Слияние трёх в одну ступенью
   * выше оборону почти не прибавляет (огонь той же силы в одной клетке), но
   * освобождает две клетки и ведёт к Багровым: без этой цены бот сливать не стал бы.
   */
  readonly tier: Readonly<Record<Tier, number>>;
}

// Веса подобраны прогонами (`npm run strategist:tune`): 8 сидов, до 50 ночей.
export const STRATEGIST: StrategistWeights = {
  meanColumn: 1,
  weakColumn: 1.5,
  potion: { raw: 2.6, bone: 7.3, obsidian: 48, crimson: 210 },
  purseBlood: 1,
  pair: 0.13,
  readyMatch: 1.2,
  readyMerge: 2.1,
  freeCell: 0.7,
  buildingPair: 1,
  bossColumn: 8,
  tier: { raw: 2, bone: 11, obsidian: 33, crimson: 113 },
};

/** Урон в секунду постройки её ступени. */
function dps(book: BuildingBook, cell: Cell): number {
  if (cell.kind !== 'building') return 0;
  const stats = statsFor(book, cell.building, cell.tier);
  return stats.damage * stats.shotsPerSecond;
}

/** Во сколько раз враг задерживается в клетке: завеса его тормозит. */
function dwell(book: BuildingBook, cell: Cell | undefined): number {
  if (cell?.kind !== 'building' || specFor(book, cell.building).pattern !== 'none') return 1;
  return 1 / (1 - statsFor(book, cell.building, cell.tier).slowFactor);
}

/**
 * Урон, который столбец успевает нанести врагу, идущему по нему: Σ по
 * клеткам столбца (с рядами под полем) урона в секунду всех, кто её держит,
 * × время в клетке.
 */
export function columnDefense(state: RunState, options: RunOptions): number[] {
  const { board } = state;
  const book = options.buildings;
  const depth = options.shootDepth ?? 0;
  const height = board.height + depth;
  const heat = Array.from({ length: height * board.width }, () => 0);
  // Клетки зоны — всегда в пределах поля с рядами под ним (`attackZone`).
  const add = (cells: readonly Position[], power: number): void => {
    for (const { x, y } of cells) {
      const index = y * board.width + x;
      heat[index] = (heat[index] as number) + power;
    }
  };

  board.cells.forEach((cell, index) => {
    const power = dps(book, cell);
    if (power === 0) return;
    const origin = { x: index % board.width, y: Math.floor(index / board.width) };
    add(attackZone(board, origin, cell, book, { shootDepth: depth }), power);
  });
  for (const slot of state.nests.slots) {
    const tower = state.nests.occupied[slot.id]?.cell;
    if (tower === undefined) continue;
    const origin = step(slot.from, slot.direction);
    add(
      attackZone(board, origin, tower, book, { shootDepth: depth, range: options.turretRange }),
      dps(book, tower),
    );
  }

  return Array.from({ length: board.width }, (_, x) => {
    let total = 0;
    for (let y = 0; y < height; y++) {
      const inside = y < board.height ? cellAt(board, { x, y }) : undefined;
      total += (heat[y * board.width + x] as number) * dwell(book, inside);
    }
    return total;
  });
}

/** Пары одинаковых построек (вид и ступень) или потиров рядом. */
function buildingPairs(board: Board): number {
  const key = (cell: Cell | undefined): string | null => {
    if (cell?.kind === 'building') return `${cell.building}-${cell.tier}`;
    if (cell?.kind === 'potion') return `potion-${cell.tier}`;
    return null;
  };
  const same = (a: Cell | undefined, b: Cell | undefined): boolean =>
    key(a) !== null && key(a) === key(b);
  let count = 0;
  board.cells.forEach((cell, index) => {
    const x = index % board.width;
    if (x + 1 < board.width && same(cell, board.cells[index + 1])) count += 1;
    if (same(cell, board.cells[index + board.width])) count += 1;
  });
  return count;
}

/** Пары одинаковых сырых плиток рядом — заготовки троек. */
function pairs(board: Board): number {
  let count = 0;
  board.cells.forEach((cell, index) => {
    if (cell.kind !== 'tile') return;
    const x = index % board.width;
    const right = x + 1 < board.width ? board.cells[index + 1] : undefined;
    const below = board.cells[index + board.width];
    for (const other of [right, below]) {
      if (other?.kind === 'tile' && other.resource === cell.resource) count += 1;
    }
  });
  return count;
}

/**
 * Что можно собрать следующим свапом — без досыпки и каскадов, это лишь
 * заготовка: сколько разных свапов дадут тройку и сколько — слияние.
 */
export function readyMoves(board: Board): { matches: number; merges: number } {
  let matches = 0;
  let merges = 0;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const from = { x, y };
      for (const to of [
        { x: x + 1, y },
        { x, y: y + 1 },
      ]) {
        if (!canSwap(board, from, to)) continue;
        const after = swap(board, from, to);
        if (findMatches(after).length > 0) matches += 1;
        if (findMerges(after, [to, from]).length > 0) merges += 1;
      }
    }
  }
  return { matches, merges };
}

export function evaluate(
  state: RunState,
  options: RunOptions,
  weights: StrategistWeights = STRATEGIST,
  bossLane: number | null = null,
): number {
  const columns = columnDefense(state, options);
  // Столбец босса игрок видит заранее — подсвечен в Сумерках.
  const lane = bossLane === null ? 0 : (columns[bossLane] as number);
  const mean = columns.reduce((sum, value) => sum + value, 0) / columns.length;
  const weak = Math.min(...columns);
  let stored = 0;
  let tiers = 0;
  for (const cell of state.board.cells) {
    if (cell.kind === 'potion') stored += weights.potion[cell.tier];
    if (cell.kind === 'building') tiers += weights.tier[cell.tier];
  }
  return (
    weights.meanColumn * mean +
    weights.weakColumn * weak +
    weights.bossColumn * lane +
    stored +
    tiers +
    weights.purseBlood * state.purse.swaps +
    weights.pair * pairs(state.board) +
    weights.freeCell * state.board.cells.filter((cell) => cell.kind === 'tile').length +
    weights.buildingPair * buildingPairs(state.board) +
    readyValue(state.board, weights)
  );
}

/** Заготовки ценны до насыщения: десятая готовая тройка почти ничего не добавляет. */
function readyValue(board: Board, weights: StrategistWeights): number {
  const { matches, merges } = readyMoves(board);
  return weights.readyMatch * Math.sqrt(matches) + weights.readyMerge * Math.sqrt(merges);
}

/** Все ходы, которые можно сделать сейчас. */
export function candidateMoves(state: RunState, options: RunOptions): PlayerMove[] {
  const { board } = state;
  const moves: PlayerMove[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const here = { x, y };
      for (const to of [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ]) {
        if (canSwap(board, here, to)) moves.push({ type: 'swap', from: here, to });
      }
      if (canOpenPotion(board, here)) moves.push({ type: 'open', at: here });
    }
  }
  for (const slot of state.nests.slots) {
    if (canPushToNest(board, state.nests, slot.from, slot.direction)) {
      moves.push({ type: 'nest', from: slot.from, direction: slot.direction });
    }
  }
  const twilight = {
    board,
    purse: state.purse,
    inventory: state.inventory,
    nests: state.nests,
  };
  return moves.filter((move) => canPlay(twilight, move, options));
}

/**
 * Сколько лучших первых ходов досчитывать на ход вперёд. По умолчанию — ни
 * одного: на прогонах второй ход вперёд не прибавил ночей (14 против 15), а
 * считал в семь раз дольше.
 */
const BEAM = 0;

/**
 * Лучший ход. Сначала каждый кандидат оценивается по полю после него; лучшие
 * `BEAM` досчитываются ещё на ход: так бот видит ходы-заготовки, которые сами
 * ничего не дают, но открывают тройку или слияние. Досыпка при расчёте — из
 * потока `rng` бота; одна и та же у всех кандидатов, чтобы их сравнение было
 * честным.
 */
export function chooseStrategistMove(
  state: RunState,
  options: RunOptions,
  rng: Rng,
  weights: StrategistWeights = STRATEGIST,
  bossLane: number | null = null,
  beam: number = BEAM,
): PlayerMove | null {
  const snapshot = rng.snapshot();
  const trial = (): RunOptions => ({ ...options, rng: restoreRng(snapshot) });
  const scored = candidateMoves(state, options).map((move) => {
    const after = stepInTwilight(state, move, trial()).run;
    return { move, after, value: evaluate(after, options, weights, bossLane) };
  });
  scored.sort((a, b) => b.value - a.value);

  let best = scored[0] ?? null;
  let bestValue = best?.value ?? Number.NEGATIVE_INFINITY;
  if (state.purse.swaps > 1) {
    for (const first of scored.slice(0, beam)) {
      let second = first.value;
      for (const move of candidateMoves(first.after, options)) {
        const value = evaluate(
          stepInTwilight(first.after, move, trial()).run,
          options,
          weights,
          bossLane,
        );
        if (value > second) second = value;
      }
      if (second > bestValue) {
        bestValue = second;
        best = first;
      }
    }
  }
  // Поток бота сдвигается, чтобы следующий ход считался на другой досыпке.
  rng.next();
  return best?.move ?? null;
}
