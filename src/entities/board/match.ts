import { positionAt } from './board';
import type { Board, Position, ResourceId } from './types';

/**
 * Тройка (§3): три и больше одинаковых **сырых** плиток подряд по горизонтали
 * или вертикали. Постройки и потиры в тройки не складываются — у них своё
 * правило, слияние.
 *
 * Пересекающиеся линии (фигуры Г и Т) считаются **одним** матчем: спека знает
 * только «тройка → постройка», и разбивать угол на два независимых матча значило
 * бы выдумать второе правило. Помечено в docs/unknowns.md.
 */
export interface Match {
  readonly resource: ResourceId;
  readonly cells: readonly Position[];
}

const MIN_RUN = 3;

/** Ресурс клетки или null, если там не сырая плитка. */
function resourceAt(board: Board, index: number): ResourceId | null {
  const cell = board.cells[index];
  return cell !== undefined && cell.kind === 'tile' ? cell.resource : null;
}

/** Все линии длиной от трёх: сначала по строкам, потом по столбцам. */
function collectRuns(board: Board): number[][] {
  const runs: number[][] = [];

  const scan = (length: number, indexOf: (step: number) => number): void => {
    let start = 0;
    while (start < length) {
      const resource = resourceAt(board, indexOf(start));
      let end = start + 1;
      if (resource !== null) {
        while (end < length && resourceAt(board, indexOf(end)) === resource) end++;
      }
      if (resource !== null && end - start >= MIN_RUN) {
        runs.push(Array.from({ length: end - start }, (_, offset) => indexOf(start + offset)));
      }
      start = end;
    }
  };

  for (let y = 0; y < board.height; y++) {
    scan(board.width, (x) => y * board.width + x);
  }
  for (let x = 0; x < board.width; x++) {
    scan(board.height, (y) => y * board.width + x);
  }

  return runs;
}

/**
 * Слияние линий, делящих клетку: угол — это один матч, а не два.
 *
 * Линий на поле в лучшем случае десяток, поэтому честный перебор понятнее
 * системы непересекающихся множеств и не оставляет веток, в которые нечем
 * попасть.
 */
function mergeRuns(runs: number[][]): number[][] {
  const groups: Set<number>[] = [];

  for (const run of runs) {
    const merged = new Set<number>(run);
    const overlapping = groups.filter((group) => run.some((index) => group.has(index)));
    for (const group of overlapping) {
      for (const index of group) merged.add(index);
      groups.splice(groups.indexOf(group), 1);
    }
    groups.push(merged);
  }

  return groups.map((group) => [...group].sort((a, b) => a - b));
}

export function findMatches(board: Board): Match[] {
  return mergeRuns(collectRuns(board)).map((group) => ({
    resource: resourceAt(board, group[0] as number) as ResourceId,
    cells: group.map((index) => positionAt(board, index)),
  }));
}

/** Все клетки всех матчей одним набором индексов. */
export function matchedIndices(board: Board, matches: readonly Match[]): Set<number> {
  const indices = new Set<number>();
  for (const match of matches) {
    for (const cell of match.cells) indices.add(cell.y * board.width + cell.x);
  }
  return indices;
}
