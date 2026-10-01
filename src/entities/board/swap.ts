import { step } from '@/shared/lib/geometry';

import { cellAt, inBounds, withCells } from './board';
import type { Board, Direction, Position } from './types';
import { EMPTY } from './types';

/**
 * Свап — единственное действие игрока в Сумерках (§3). Меняет местами две
 * соседние клетки по вертикали или горизонтали; диагоналей нет.
 *
 * Двигать можно и плитку, и готовую постройку — на этом держится вся тактика:
 * ход тратится, тройки может не быть, зато постройка встаёт куда нужно.
 */
export function canSwap(board: Board, from: Position, to: Position): boolean {
  if (!inBounds(board, from) || !inBounds(board, to)) return false;
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1;
}

export function swap(board: Board, from: Position, to: Position): Board {
  if (!canSwap(board, from, to)) {
    throw new Error(
      `Недопустимый свап (${String(from.x)}, ${String(from.y)}) ↔ (${String(to.x)}, ${String(to.y)})`,
    );
  }
  return withCells(board, [
    [from, cellAt(board, to)],
    [to, cellAt(board, from)],
  ]);
}

/**
 * Сброс за край (§3): ненужный сырой ресурс уходит с поля, чтобы не тратить
 * свап на бесполезную тройку. Сам сброс свап всё равно тратит — но это забота
 * экономики, а не поля.
 *
 * Сбрасывать можно с боков и снизу. Вверх нельзя: там цитадель.
 * Как в оригинале («Toss Away»), уходит и готовая постройка — освободить место;
 * подтверждение спрашивает интерфейс. Потир остаётся: в нём кровь, выбросить
 * его — просто её потерять.
 */
export function canDropOffEdge(board: Board, from: Position, direction: Direction): boolean {
  if (!inBounds(board, from)) return false;
  if (direction === 'up') return false;
  const { kind } = cellAt(board, from);
  if (kind !== 'tile' && kind !== 'building') return false;

  return !inBounds(board, step(from, direction));
}

export function dropOffEdge(board: Board, from: Position, direction: Direction): Board {
  if (!canDropOffEdge(board, from, direction)) {
    throw new Error(
      `Нельзя сбросить (${String(from.x)}, ${String(from.y)}) в сторону «${direction}»`,
    );
  }
  return withCells(board, [[from, EMPTY]]);
}
