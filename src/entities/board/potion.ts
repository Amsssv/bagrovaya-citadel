import type { Tier } from '@/entities/building';

import { cellAt, inBounds, withCells } from './board';
import type { Board, Cell, Position } from './types';
import { EMPTY } from './types';

/**
 * Вскрытие потира (§8): потир уходит с поля, а сколько он даёт свапов — решает
 * экономика по его ступени. Освободившаяся клетка закрывается досыпкой.
 *
 * Чем именно вскрытие запускается, спека не говорит. §3 утверждает, что другого
 * действия в Сумерках нет, значит отдельной кнопки быть не может — остаётся
 * свап в потир. Но потиры ещё и сливаются по трое (§8), то есть двигать их
 * нужно уметь, не вскрывая. Поэтому здесь только сама операция, а что считать
 * поводом — забота вызывающего. Реестр — docs/unknowns.md.
 */
export interface OpenedPotion {
  readonly board: Board;
  readonly tier: Tier;
}

function potionAt(board: Board, position: Position): Extract<Cell, { kind: 'potion' }> | null {
  if (!inBounds(board, position)) return null;
  const cell = cellAt(board, position);
  return cell.kind === 'potion' ? cell : null;
}

export function canOpenPotion(board: Board, position: Position): boolean {
  return potionAt(board, position) !== null;
}

export function openPotion(board: Board, position: Position): OpenedPotion {
  const cell = potionAt(board, position);
  if (cell === null) {
    throw new Error(`В клетке (${String(position.x)}, ${String(position.y)}) потира нет`);
  }
  return { board: withCells(board, [[position, EMPTY]]), tier: cell.tier };
}
