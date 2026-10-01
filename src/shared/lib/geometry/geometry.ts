/**
 * Геометрия поля. Живёт в shared, а не в entities/board, потому что нужна и
 * полю, и постройкам: иначе слайсы начали бы ссылаться друг на друга по кругу.
 *
 * Цитадель сверху, охотники заходят снизу и идут вверх (§2, §4), поэтому y
 * растёт **вниз**: y = 0 — ряд у цитадели, туда же приходит досыпка.
 */
export interface Position {
  readonly x: number;
  readonly y: number;
}

/** Четыре стороны. Диагоналей в игре нет (§3). */
export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

export const STEP: Readonly<Record<Direction, Position>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function opposite(direction: Direction): Direction {
  return OPPOSITE[direction];
}

export function step(position: Position, direction: Direction, times = 1): Position {
  const delta = STEP[direction];
  return { x: position.x + delta.x * times, y: position.y + delta.y * times };
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
