import type { Board, BuildingCell, Cell, Direction, Position } from '@/entities/board';
import { EMPTY, cellAt, inBounds, withCells } from '@/entities/board';
import type { BuildingId } from '@/entities/building';
import { TIERS } from '@/entities/building';

/**
 * Гнёзда на башне (§9) — башни замка оригинала (docs/original-analysis.md):
 * постройку из клетки у края поля вталкивают в гнездо, и оттуда она стреляет.
 *
 * Правила — как в оригинале:
 *   • гнездо принимает только постройки из `accepts` (в оригинале — стрелковую
 *     башню, то есть горгулью); без списка — любую постройку;
 *   • занятое гнездо перевооружают только постройкой **ступенью выше** — прежняя
 *     при этом пропадает; той же или ниже — нельзя.
 *
 * Раскладка — данными в `shared/config/balance.ts` → `citadel.nests`.
 * Мортира в гнезде разворачивается (§9): хранение направления есть, но в
 * оригинале в гнёзда мортиры не ставят.
 */
export interface NestSlot {
  readonly id: string;
  /** Клетка поля, из которой в это гнездо толкают. */
  readonly from: Position;
  readonly direction: Direction;
  /** Какие постройки гнездо принимает. Не задано — любые. */
  readonly accepts?: readonly BuildingId[] | undefined;
}

/** Что стоит в гнезде и куда смотрит: мортиру в гнезде разворачивают (§9). */
export interface NestContents {
  readonly cell: Cell;
  readonly facing: Direction;
}

export interface Nests {
  readonly slots: readonly NestSlot[];
  readonly occupied: Readonly<Record<string, NestContents>>;
}

export interface PushResult {
  readonly board: Board;
  readonly nests: Nests;
  readonly slot: NestSlot;
}

export function createNests(slots: readonly NestSlot[]): Nests {
  return { slots, occupied: {} };
}

/** Что лежит в гнезде. null — пусто или гнезда с таким id нет. */
export function nestContents(nests: Nests, id: string): NestContents | null {
  return nests.occupied[id] ?? null;
}

/** Гнездо, привязанное к этой клетке и стороне. */
function slotFor(nests: Nests, from: Position, direction: Direction): NestSlot | null {
  return (
    nests.slots.find(
      (candidate) =>
        candidate.from.x === from.x &&
        candidate.from.y === from.y &&
        candidate.direction === direction,
    ) ?? null
  );
}

/** Пустое гнездо принимает всё подходящее; занятое — только ступень выше. */
function takes(slot: NestSlot, occupant: NestContents | undefined, cell: BuildingCell): boolean {
  if (slot.accepts !== undefined && !slot.accepts.includes(cell.building)) return false;
  if (occupant === undefined) return true;
  if (occupant.cell.kind !== 'building') return false;
  return TIERS.indexOf(cell.tier) > TIERS.indexOf(occupant.cell.tier);
}

function pushableAt(
  board: Board,
  nests: Nests,
  from: Position,
  direction: Direction,
): NestSlot | null {
  const slot = slotFor(nests, from, direction);
  if (slot === null || !inBounds(board, from)) return null;
  const cell = cellAt(board, from);
  if (cell.kind !== 'building') return null;
  return takes(slot, nests.occupied[slot.id], cell) ? slot : null;
}

export function canPushToNest(
  board: Board,
  nests: Nests,
  from: Position,
  direction: Direction,
): boolean {
  return pushableAt(board, nests, from, direction) !== null;
}

export function pushToNest(
  board: Board,
  nests: Nests,
  from: Position,
  direction: Direction,
  facing: Direction,
): PushResult {
  const slot = pushableAt(board, nests, from, direction);
  if (slot === null) {
    throw new Error(
      `Из клетки (${String(from.x)}, ${String(from.y)}) в сторону «${direction}» гнезда нет`,
    );
  }

  return {
    board: withCells(board, [[from, EMPTY]]),
    nests: {
      ...nests,
      occupied: { ...nests.occupied, [slot.id]: { cell: cellAt(board, from), facing } },
    },
    slot,
  };
}

/**
 * Развернуть то, что стоит в гнезде (§9). На круговой огонь и на туман поворот
 * не влияет — это забота вызывающего, здесь только хранение.
 */
export function rotateNest(nests: Nests, id: string, facing: Direction): Nests {
  const contents = nestContents(nests, id);
  if (contents === null) throw new Error(`Гнездо «${id}» пусто — разворачивать нечего`);
  return { ...nests, occupied: { ...nests.occupied, [id]: { ...contents, facing } } };
}
