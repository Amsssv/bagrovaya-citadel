import type { SealId, Tier } from '@/entities/building';
import type { Rng } from '@/shared/lib/rng';

import { withCells } from './board';
import type { FallMap } from './gravity';
import { settle as settleOnly, settleAndRefill } from './gravity';
import type { Match } from './match';
import { findMatches } from './match';
import type { Merge } from './merge';
import { applyMerges, findMerges } from './merge';
import { openPotion } from './potion';
import { applySealAt } from './seal';
import { blast, place, teleport } from './tools';
import { dropOffEdge, swap } from './swap';
import type { Board, Cell, Direction, Position, ResourceId } from './types';
import { EMPTY, HARVEST, building, potion } from './types';

export interface ResolveOptions {
  readonly rng: Rng;
  readonly resources: readonly ResourceId[];
  /**
   * Досыпка может сама сложить тройку. Считается ли это и даёт ли награду —
   * §14 #6, пока не проверено. По умолчанию выключено.
   */
  readonly cascadesEnabled?: boolean;
  /**
   * Досыпать ли сверху. Выключают в выходной (день перестановки): рабочие
   * замка двигают что есть, нового ничего не падает — плитки только оседают.
   */
  readonly refill?: boolean;
  /**
   * Защитный предел кругов «тройки → слияния → досыпка». Каскад с одним
   * ресурсом теоретически может крутиться бесконечно; лучше явная ошибка, чем
   * повисший прогон бота.
   */
  readonly maxRounds?: number;
}

const DEFAULT_MAX_ROUNDS = 64;

/**
 * Шаг хода — то, что анимация проигрывает по очереди.
 *
 * Домен считает ход мгновенно и отдаёт не только итог, но и последовательность
 * состояний поля: сцена показывает их со своей скоростью, а логика её не ждёт.
 * Без этого анимации пришлось бы угадывать, что произошло, по разнице полей.
 */
export interface MoveStage {
  readonly kind: 'action' | 'reap' | 'merge' | 'settle';
  /** Поле после этого шага. */
  readonly board: Board;
  /** Клетки, опустевшие на этом шаге. */
  readonly removed: readonly Position[];
  /** Клетки, где что-то появилось. */
  readonly appeared: readonly Position[];
  /** Клетки, поменявшиеся местами: только у свапа. */
  readonly moved: readonly Position[];
  /** Высоты падения — только у оседания. */
  readonly fallen: FallMap;
  /**
   * Группы по отдельности — у сбора и у слияния. `removed` сливает их в одно,
   * а нужны они порознь: длинная группа возвращает кровь, и каждая стягивается
   * в свою клетку.
   */
  readonly groups: readonly (readonly Position[])[];
}

const NO_FALL: FallMap = new Map();

function stage(
  kind: MoveStage['kind'],
  board: Board,
  parts: Partial<Omit<MoveStage, 'kind' | 'board'>> = {},
): MoveStage {
  return {
    kind,
    board,
    removed: parts.removed ?? [],
    appeared: parts.appeared ?? [],
    moved: parts.moved ?? [],
    fallen: parts.fallen ?? NO_FALL,
    groups: parts.groups ?? [],
  };
}

export interface Spawned {
  /** Клетка, где постройка появилась — **до** гравитации. */
  readonly position: Position;
  readonly cell: Cell;
}

export interface MoveResult {
  readonly board: Board;
  readonly matches: readonly Match[];
  readonly spawned: readonly Spawned[];
  readonly merges: readonly Merge[];
  readonly fallen: FallMap;
  /** Была ли досыпка. Пока её не было, ход можно отменить (§3). */
  readonly refilled: boolean;
  /** Последовательность состояний поля для анимации. */
  readonly stages: readonly MoveStage[];
}

const samePosition = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

/**
 * Где встанет постройка (§6): на клетке, где игрок в последний раз двигал
 * элемент. Свап трогает ровно две клетки, и матч от свапа содержит одну из них,
 * поэтому место определено однозначно.
 *
 * Матч из каскада не содержит ни одной клетки игрока: спека про это молчит,
 * берём середину группы как заглушку. Реестр — docs/unknowns.md.
 */
function spawnPositionFor(match: Match, preferred: readonly Position[]): Position {
  const chosen = preferred.find((position) =>
    match.cells.some((cell) => samePosition(cell, position)),
  );
  return chosen ?? (match.cells[Math.floor(match.cells.length / 2)] as Position);
}

/** Во что превращается тройка этого ресурса — постройка или потир (§5). */
function harvestOf(resource: ResourceId): Cell {
  const result = HARVEST[resource];
  return result === 'potion' ? potion('raw') : building(result, 'raw');
}

/** Убрать клетки матчей и поставить на выбранные места то, что они дали. */
function reap(
  board: Board,
  matches: readonly Match[],
  preferred: readonly Position[],
): { board: Board; spawned: Spawned[] } {
  const patches: [Position, Cell][] = [];
  const spawned: Spawned[] = [];

  for (const match of matches) {
    for (const cell of match.cells) patches.push([cell, EMPTY]);
  }
  for (const match of matches) {
    const position = spawnPositionFor(match, preferred);
    const cell = harvestOf(match.resource);
    patches.push([position, cell]);
    spawned.push({ position, cell });
  }

  return { board: withCells(board, patches), spawned };
}

/** Чем ход начинается — от этого зависит, что искать на первом круге. */
interface Flow {
  /** Куда ставить результат: клетки, которые игрок трогал последними. */
  readonly preferred: readonly Position[];
  /** Первый шаг: сам свап, сброс за край или вскрытие потира. */
  readonly action: MoveStage;
  /** Свап мог сразу замкнуть тройку; сброс за край — нет, он только убирает. */
  readonly matchOnFirstRound: boolean;
  /** Сброс оставляет дыру, её надо закрыть до того, как что-то искать. */
  readonly settleFirst: boolean;
}

/**
 * Общий круг: тройки → слияния → гравитация → досыпка, и заново.
 *
 * Тройки ищутся только на первом круге: всё, что сложилось после досыпки, —
 * это уже каскад, и он за флагом. Слияния ищутся всегда: они происходят сами,
 * без участия игрока.
 */
function resolveMove(board: Board, flow: Flow, options: ResolveOptions): MoveResult {
  let current = board;
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;

  const matches: Match[] = [];
  const spawned: Spawned[] = [];
  const merges: Merge[] = [];
  const fallen = new Map<number, number>();
  const stages: MoveStage[] = [flow.action];
  let refilled = false;
  let rounds = 0;

  const settle = (): void => {
    const refill = options.refill !== false;
    const result = refill
      ? settleAndRefill(current, options.rng, options.resources)
      : settleOnly(current);
    current = result.board;
    for (const [index, distance] of result.fallen) fallen.set(index, distance);
    stages.push(stage('settle', current, { fallen: result.fallen }));
    refilled ||= refill;
  };

  if (flow.settleFirst) settle();

  for (;;) {
    const lookForMatches =
      (rounds === 0 && flow.matchOnFirstRound) || options.cascadesEnabled === true;
    const round = lookForMatches ? findMatches(current) : [];
    if (round.length > 0) {
      matches.push(...round);
      const reaped = reap(current, round, flow.preferred);
      spawned.push(...reaped.spawned);
      current = reaped.board;
      stages.push(
        stage('reap', current, {
          removed: round.flatMap((match) => match.cells),
          appeared: reaped.spawned.map((item) => item.position),
          groups: round.map((match) => match.cells),
        }),
      );
    }

    const merged = findMerges(current, flow.preferred);
    if (merged.length > 0) {
      merges.push(...merged);
      current = applyMerges(current, merged);
      stages.push(
        stage('merge', current, {
          removed: merged.flatMap((item) => item.cells),
          appeared: merged.map((item) => item.position),
          groups: merged.map((item) => item.cells),
        }),
      );
    }

    if (round.length === 0 && merged.length === 0) {
      // Без досыпки в поле бывают дыры не только сверху: плитку или постройку
      // передвинули в пустую клетку — над ней всё должно осесть, а осевшее
      // может сложить слияние.
      if (options.refill !== false || settleOnly(current).fallen.size === 0) break;
      settle();
      continue;
    }

    if (++rounds > maxRounds) {
      throw new Error(`Ход не сошёлся за ${String(maxRounds)} кругов — похоже на зацикливание`);
    }
    settle();
  }

  return { board: current, matches, spawned, merges, fallen, refilled, stages };
}

/**
 * Ход игрока целиком: свап → тройки → постройки → гравитация → досыпка.
 *
 * Свап засчитывается, даже если тройка не собралась (§3) — тогда ни построек,
 * ни досыпки, и ход ещё можно отменить.
 */
export function applySwap(
  board: Board,
  from: Position,
  to: Position,
  options: ResolveOptions,
): MoveResult {
  const swapped = swap(board, from, to);
  return resolveMove(
    swapped,
    {
      preferred: [to, from],
      matchOnFirstRound: true,
      settleFirst: false,
      action: stage('action', swapped, { moved: [from, to] }),
    },
    options,
  );
}

/**
 * Сброс за край (§3): сырой ресурс уходит с поля, дыра закрывается досыпкой.
 * Тройку сброс замкнуть не может — он только убирает, — но осевшие постройки
 * вполне могут встать рядом и слиться.
 *
 * Свап сброс тратит (§3), но счётчик живёт в экономике, не на поле.
 */
export function applyEdgeDrop(
  board: Board,
  from: Position,
  direction: Direction,
  options: ResolveOptions,
): MoveResult {
  const dropped = dropOffEdge(board, from, direction);
  return resolveMove(
    dropped,
    {
      preferred: [from],
      matchOnFirstRound: false,
      settleFirst: true,
      action: stage('action', dropped, { removed: [from] }),
    },
    options,
  );
}

/**
 * Вскрытие потира (§8). Потир уходит, клетка закрывается досыпкой; сколько
 * свапов он дал — считает экономика по ступени из `tier`.
 */
export function applyPotionOpen(
  board: Board,
  at: Position,
  options: ResolveOptions,
): MoveResult & { readonly tier: Tier } {
  const opened = openPotion(board, at);
  return {
    ...resolveMove(
      opened.board,
      {
        preferred: [at],
        matchOnFirstRound: false,
        settleFirst: true,
        action: stage('action', opened.board, { removed: [at] }),
      },
      options,
    ),
    tier: opened.tier,
  };
}

/**
 * Постройку подняли с поля — например, в башню замка. Клетка пустеет, дыра
 * закрывается досыпкой; оставшиеся постройки при этом могут сомкнуться и слиться.
 */
export function applyLift(board: Board, at: Position, options: ResolveOptions): MoveResult {
  const lifted = withCells(board, [[at, EMPTY]]);
  return resolveMove(
    lifted,
    {
      preferred: [at],
      matchOnFirstRound: false,
      settleFirst: true,
      action: stage('action', lifted, { removed: [at] }),
    },
    options,
  );
}

/**
 * Проклятый прах (§11): клетка подрывается, дыра закрывается досыпкой. Тройку
 * подрыв не замыкает — он только убирает.
 */
export function applyBlast(board: Board, at: Position, options: ResolveOptions): MoveResult {
  const blasted = blast(board, at);
  return resolveMove(
    blasted,
    {
      preferred: [at],
      matchOnFirstRound: false,
      settleFirst: true,
      action: stage('action', blasted, { removed: [at] }),
    },
    options,
  );
}

/**
 * Нетопыри (§11): меняют местами два объекта где угодно на поле. Тройку замкнуть
 * могут — этим они и ценны.
 */
export function applyTeleport(
  board: Board,
  a: Position,
  b: Position,
  options: ResolveOptions,
): MoveResult {
  const swapped = teleport(board, a, b);
  return resolveMove(
    swapped,
    {
      preferred: [b, a],
      matchOnFirstRound: true,
      settleFirst: false,
      action: stage('action', swapped, { moved: [a, b] }),
    },
    options,
  );
}

/**
 * Столб тумана (§11): постройка ставится из инвентаря. Троек не образует, но
 * может замкнуть слияние — их разрешение ищет всегда.
 */
export function applyPlacement(
  board: Board,
  at: Position,
  cell: Cell,
  options: ResolveOptions,
): MoveResult {
  const placed = place(board, at, cell);
  return resolveMove(
    placed,
    {
      preferred: [at],
      matchOnFirstRound: false,
      settleFirst: false,
      action: stage('action', placed, { appeared: [at] }),
    },
    options,
  );
}

/**
 * Печать крови (§6, §11): поднимает одну постройку на ступень. Поднятая может
 * оказаться третьей одинаковой рядом — тогда тут же произойдёт слияние.
 */
export function applySeal(
  board: Board,
  at: Position,
  seal: SealId,
  options: ResolveOptions,
): MoveResult {
  const sealed = applySealAt(board, at, seal);
  return resolveMove(
    sealed,
    {
      preferred: [at],
      matchOnFirstRound: false,
      settleFirst: false,
      action: stage('action', sealed, { appeared: [at] }),
    },
    options,
  );
}
