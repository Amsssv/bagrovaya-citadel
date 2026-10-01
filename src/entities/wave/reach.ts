import type { Board, Cell } from '@/entities/board';
import { coveredCells } from '@/entities/board';
import type { BuildingBook } from '@/entities/building';
import { specFor, statsFor } from '@/entities/building';
import type { Position } from '@/shared/lib/geometry';

/**
 * Какие клетки держит постройка — те же, что в расчёте боя (`simulate.ts`),
 * чтобы подсказка на поле не расходилась с тем, куда она на самом деле бьёт.
 *
 * Поле продлено вниз на `shootDepth` рядов: туда достают лоза по своему
 * столбцу и горгульи нижнего ряда. Завеса не стреляет — её зона своя клетка,
 * где она тормозит врагов. Башня замка стоит за краем поля (`origin` выше
 * нулевого ряда) и бьёт со своим радиусом `range`.
 */
export interface ReachOptions {
  readonly shootDepth?: number | undefined;
  /** Радиус вместо радиуса ступени — у башни замка. */
  readonly range?: number | undefined;
}

export function attackZone(
  board: Board,
  origin: Position,
  cell: Cell,
  book: BuildingBook,
  options: ReachOptions = {},
): Position[] {
  if (cell.kind !== 'building') return [];
  const spec = specFor(book, cell.building);
  if (spec.pattern === 'none') return [origin];
  const stats = statsFor(book, cell.building, cell.tier);
  const reach: Board = { ...board, height: board.height + (options.shootDepth ?? 0) };
  return coveredCells(
    reach,
    origin,
    {
      pattern: spec.pattern,
      aroundShape: spec.aroundShape,
      range: options.range ?? stats.range,
      blockedByBuildings: spec.blockedByBuildings,
    },
    spec.defaultFacing,
  );
}
