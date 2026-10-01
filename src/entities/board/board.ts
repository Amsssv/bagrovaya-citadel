import type { Board, Cell, Position } from './types';
import { EMPTY } from './types';

export function createEmptyBoard(width: number, height: number): Board {
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => EMPTY),
  };
}

/** Индекс в плоском массиве. y = 0 — ряд у цитадели. */
export function indexAt(board: Board, position: Position): number {
  return position.y * board.width + position.x;
}

export function positionAt(board: Board, index: number): Position {
  return { x: index % board.width, y: Math.floor(index / board.width) };
}

export function inBounds(board: Board, position: Position): boolean {
  return (
    position.x >= 0 && position.x < board.width && position.y >= 0 && position.y < board.height
  );
}

function assertInBounds(board: Board, position: Position): void {
  if (!inBounds(board, position)) {
    throw new RangeError(`Клетка (${String(position.x)}, ${String(position.y)}) за краем поля`);
  }
}

export function cellAt(board: Board, position: Position): Cell {
  assertInBounds(board, position);
  return board.cells[indexAt(board, position)] as Cell;
}

/** Новое поле с заменёнными клетками. Исходное не трогает. */
export function withCells(board: Board, patches: Iterable<readonly [Position, Cell]>): Board {
  const cells = [...board.cells];
  for (const [position, cell] of patches) {
    assertInBounds(board, position);
    cells[indexAt(board, position)] = cell;
  }
  return { ...board, cells };
}
