import type { Rng } from '@/shared/lib/rng';

import type { Board, Cell, ResourceId } from './types';
import { EMPTY, tile } from './types';

/**
 * Сколько клеток пролетело содержимое, вставшее в этот индекс. Нужна только
 * анимации: домен считает мгновенно, а сцена по этой карте знает, с какой
 * высоты выпускать спрайт. Клетки, которые не двигались, в карту не попадают.
 */
export type FallMap = ReadonlyMap<number, number>;

export interface SettleResult {
  readonly board: Board;
  readonly fallen: FallMap;
}

/**
 * Гравитация. Падает **всё** содержимое клетки — плитки, постройки, потиры:
 * закреплённых клеток на поле нет. Оседает вниз, к охотникам; пустота
 * собирается сверху, у цитадели, куда потом придут новые плитки.
 */
export function settle(board: Board): SettleResult {
  const cells: Cell[] = Array.from({ length: board.cells.length }, () => EMPTY);
  const fallen = new Map<number, number>();

  for (let x = 0; x < board.width; x++) {
    const occupied: { cell: Cell; y: number }[] = [];
    for (let y = 0; y < board.height; y++) {
      const cell = board.cells[y * board.width + x] as Cell;
      if (cell.kind !== 'empty') occupied.push({ cell, y });
    }

    let writeY = board.height - 1;
    for (let i = occupied.length - 1; i >= 0; i--) {
      const item = occupied[i] as { cell: Cell; y: number };
      const index = writeY * board.width + x;
      cells[index] = item.cell;
      if (writeY !== item.y) fallen.set(index, writeY - item.y);
      writeY--;
    }
  }

  return { board: { ...board, cells }, fallen };
}

/**
 * Досыпка. Новые плитки приходят сверху, со стороны цитадели, и падают вниз.
 *
 * Высота падения у всех новых плиток столбца одна и та же — столько, сколько их
 * пришло: они стоят очередью над полем и съезжают вниз единым столбиком.
 *
 * Ждёт осевшее поле (`settle` до него), иначе «сколько пришло в столбец» теряет
 * смысл. Порядок выборки — столбцы слева направо, внутри столбца сверху вниз;
 * от него зависит воспроизводимость по сиду.
 */
export function refill(board: Board, rng: Rng, resources: readonly ResourceId[]): SettleResult {
  const cells = [...board.cells];
  const fallen = new Map<number, number>();

  for (let x = 0; x < board.width; x++) {
    const holes: number[] = [];
    for (let y = 0; y < board.height; y++) {
      const index = y * board.width + x;
      if ((board.cells[index] as Cell).kind === 'empty') holes.push(index);
    }

    for (const index of holes) {
      cells[index] = tile(rng.pick(resources));
      fallen.set(index, holes.length);
    }
  }

  return { board: { ...board, cells }, fallen };
}

/** Осесть и досыпать за один проход, с общей картой высот. */
export function settleAndRefill(
  board: Board,
  rng: Rng,
  resources: readonly ResourceId[],
): SettleResult {
  const settled = settle(board);
  const filled = refill(settled.board, rng, resources);
  return {
    board: filled.board,
    fallen: new Map([...settled.fallen, ...filled.fallen]),
  };
}
