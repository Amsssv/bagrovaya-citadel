import type { Board, Position } from '@/entities/board';
import { EMPTY, cellAt, inBounds, withCells } from '@/entities/board';

import type { Citadel } from './hearts';
import { restoreHearts } from './hearts';

/**
 * Замуровывание камня (§9): камень из верхнего ряда уходит в стену и даёт
 * сердце. Верхний ряд — тот, что примыкает к цитадели.
 *
 * Спека не говорит, срабатывает ли это само или только когда игрок сам затолкал
 * камень наверх. Поэтому здесь только сама операция, а решение «какие клетки
 * считать кандидатами» принимает вызывающий: флаг `wallInIsAutomatic`
 * в конфиге, реестр — docs/unknowns.md.
 */
export interface WallInResult {
  readonly board: Board;
  readonly citadel: Citadel;
  /** Клетки, которые действительно ушли в стену. */
  readonly walled: readonly Position[];
}

const TOP_ROW = 0;

function isWallable(board: Board, position: Position): boolean {
  if (!inBounds(board, position) || position.y !== TOP_ROW) return false;
  const cell = cellAt(board, position);
  return cell.kind === 'tile' && cell.resource === 'stone';
}

/** Камни верхнего ряда, слева направо. */
export function wallInCandidates(board: Board): Position[] {
  const candidates: Position[] = [];
  for (let x = 0; x < board.width; x++) {
    const position = { x, y: TOP_ROW };
    if (isWallable(board, position)) candidates.push(position);
  }
  return candidates;
}

/**
 * Замуровать перечисленные камни. На потолке сердец камень остаётся на месте:
 * тратить его впустую незачем. Порядок обработки — как передали.
 */
export function wallInStones(
  board: Board,
  citadel: Citadel,
  positions: readonly Position[],
  heartsPerStone: number,
): WallInResult {
  const walled: Position[] = [];
  let current = citadel;

  for (const position of positions) {
    if (!isWallable(board, position)) {
      throw new Error(
        `Клетка (${String(position.x)}, ${String(position.y)}) не камень в верхнем ряду`,
      );
    }
    if (current.hearts >= current.maxHearts) continue;
    current = restoreHearts(current, heartsPerStone);
    walled.push(position);
  }

  return {
    board: withCells(
      board,
      walled.map((position) => [position, EMPTY] as const),
    ),
    citadel: current,
    walled,
  };
}
