import type { SealId } from '@/entities/building';
import { canSealTier, sealTier } from '@/entities/building';

import { cellAt, inBounds, withCells } from './board';
import type { Board, Cell, Position } from './types';

/**
 * Печать крови на поле (§6): поднимает одну постройку на ступень, не требуя
 * трёх. Ложится только на постройку ровно предыдущей ступени.
 *
 * На потиры не действует: потир — не постройка. В спеке помечено ❓,
 * перепроверить в оригинале (§14 #16).
 */
function sealableAt(
  board: Board,
  position: Position,
  seal: SealId,
): Extract<Cell, { kind: 'building' }> | null {
  if (!inBounds(board, position)) return null;
  const cell = cellAt(board, position);
  if (cell.kind !== 'building' || !canSealTier(cell.tier, seal)) return null;
  return cell;
}

export function canSealAt(board: Board, position: Position, seal: SealId): boolean {
  return sealableAt(board, position, seal) !== null;
}

export function applySealAt(board: Board, position: Position, seal: SealId): Board {
  const cell = sealableAt(board, position, seal);
  if (cell === null) {
    throw new Error(
      `Печать «${seal}» не ложится на клетку (${String(position.x)}, ${String(position.y)})`,
    );
  }
  // Печать меняет только ступень: развёрнутая мортира остаётся развёрнутой.
  return withCells(board, [[position, { ...cell, tier: sealTier(cell.tier, seal) }]]);
}
