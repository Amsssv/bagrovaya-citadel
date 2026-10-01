import { cellAt, inBounds, withCells } from './board';
import type { Board, Cell, Position } from './types';
import { EMPTY } from './types';

/**
 * Действия предметов на поле (§11). В отличие от свапа, они не стоят хода и не
 * подчиняются правилу соседства — на то они и предметы.
 *
 * Здесь только сами операции; сколько их осталось в инвентаре и тратят ли они
 * свап, решает фаза Сумерек.
 */

/** Проклятый прах: подрывает одну клетку, что бы в ней ни лежало. */
export function canBlast(board: Board, at: Position): boolean {
  return inBounds(board, at) && cellAt(board, at).kind !== 'empty';
}

export function blast(board: Board, at: Position): Board {
  if (!canBlast(board, at)) {
    throw new Error(`В клетке (${String(at.x)}, ${String(at.y)}) подрывать нечего`);
  }
  return withCells(board, [[at, EMPTY]]);
}

/**
 * Нетопыри: меняют местами два объекта на поле. Соседство не требуется — этим
 * они и отличаются от обычного свапа.
 */
export function canTeleport(board: Board, a: Position, b: Position): boolean {
  if (!inBounds(board, a) || !inBounds(board, b)) return false;
  return a.x !== b.x || a.y !== b.y;
}

export function teleport(board: Board, a: Position, b: Position): Board {
  if (!canTeleport(board, a, b)) {
    throw new Error(
      `Нельзя поменять местами (${String(a.x)}, ${String(a.y)}) и (${String(b.x)}, ${String(b.y)})`,
    );
  }
  return withCells(board, [
    [a, cellAt(board, b)],
    [b, cellAt(board, a)],
  ]);
}

/**
 * Столб тумана: ставится из инвентаря. Поверх постройки или потира не встаёт —
 * иначе накопленное молча пропало бы; сырую плитку вытесняет.
 */
export function canPlace(board: Board, at: Position): boolean {
  if (!inBounds(board, at)) return false;
  const kind = cellAt(board, at).kind;
  return kind === 'tile' || kind === 'empty';
}

export function place(board: Board, at: Position, cell: Cell): Board {
  if (!canPlace(board, at)) {
    throw new Error(`В клетку (${String(at.x)}, ${String(at.y)}) ставить нельзя`);
  }
  return withCells(board, [[at, cell]]);
}
