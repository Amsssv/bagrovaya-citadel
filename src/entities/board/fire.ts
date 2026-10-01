import type { AroundShape, FirePattern } from '@/entities/building';
import type { Direction, Position } from '@/shared/lib/geometry';
import { step } from '@/shared/lib/geometry';

import { cellAt, inBounds } from './board';
import type { Board, Cell } from './types';

/**
 * Что постройка простреливает со своей клетки (§7).
 *
 * `single` и `beam` дают одинаковый набор клеток: разница между «одной целью»
 * и «всей линией» — в том, скольких из них накрывает выстрел, и это уже забота
 * расчёта боя, а не геометрии.
 */
export interface FireSpec {
  readonly pattern: FirePattern;
  readonly aroundShape: AroundShape;
  readonly range: number;
  readonly blockedByBuildings: boolean;
}

/** Перекрывает ли клетка линию огня. Плитки — нет: поле всегда полное. */
function blocks(cell: Cell): boolean {
  return cell.kind === 'building' || cell.kind === 'potion';
}

/**
 * Круг вокруг: восемь клеток или четыре, смотря как понимать «радиус 1», — и
 * своя клетка: враг проходит сквозь постройку и в ней тоже получает удар (как
 * в оригинале).
 */
function cellsAround(board: Board, origin: Position, spec: FireSpec): Position[] {
  const cells: Position[] = [];

  for (let dy = -spec.range; dy <= spec.range; dy++) {
    for (let dx = -spec.range; dx <= spec.range; dx++) {
      if (spec.aroundShape === 'manhattan' && Math.abs(dx) + Math.abs(dy) > spec.range) continue;

      const position = { x: origin.x + dx, y: origin.y + dy };
      if (inBounds(board, position)) cells.push(position);
    }
  }

  return cells;
}

/**
 * Линия по направлению. Обрывается на краю поля, а для мортиры — ещё и на
 * первой постройке: «ставить что-либо перед ней нельзя» (§7). Сама преграда
 * под удар не попадает.
 */
function cellsInLine(
  board: Board,
  origin: Position,
  spec: FireSpec,
  facing: Direction,
): Position[] {
  const cells: Position[] = [];

  for (let distance = 1; distance <= spec.range; distance++) {
    const position = step(origin, facing, distance);
    if (!inBounds(board, position)) break;
    if (spec.blockedByBuildings && blocks(cellAt(board, position))) break;
    cells.push(position);
  }

  return cells;
}

/**
 * Вся линия поля через клетку: столбец или ряд, **вместе с самой клеткой**.
 * Охотник проходит сквозь постройку насквозь (§4), и пока он в её клетке, лоза
 * и мортира достают его так же, как в любой другой клетке линии.
 */
function wholeLine(board: Board, origin: Position, axis: 'column' | 'row'): Position[] {
  const length = axis === 'column' ? board.height : board.width;
  return Array.from({ length }, (_, i) =>
    axis === 'column' ? { x: origin.x, y: i } : { x: i, y: origin.y },
  );
}

export function coveredCells(
  board: Board,
  origin: Position,
  spec: FireSpec,
  facing: Direction,
): Position[] {
  if (spec.pattern === 'none') return [];
  if (spec.pattern === 'around') return cellsAround(board, origin, spec);
  // Лоза и мортира: вся линия в обе стороны, преград и дальности нет — куда
  // бить, решает выбор цели, а не направление постройки.
  if (spec.pattern === 'column' || spec.pattern === 'row') {
    return wholeLine(board, origin, spec.pattern);
  }
  return cellsInLine(board, origin, spec, facing);
}
