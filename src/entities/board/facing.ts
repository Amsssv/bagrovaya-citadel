import type { Cell } from './types';

/** У скольких правых столбцов поставленная постройка смотрит влево. */
const LEFT_FACING_COLUMNS = 2;

/**
 * Куда смотрит постройка в клетке. Мортира в оригинале смотрит вправо, а
 * поставленная у правого края — влево; развернуть её можно тапом (`facing`).
 * Одно правило на бой, Сумерки и рисунок.
 */
export function facingOf(cell: Cell, x: number, width: number): 'left' | 'right' {
  if (cell.kind === 'building' && cell.facing !== undefined) return cell.facing;
  return x >= width - LEFT_FACING_COLUMNS ? 'left' : 'right';
}
