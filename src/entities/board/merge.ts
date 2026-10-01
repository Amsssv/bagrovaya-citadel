import { nextTier } from '@/entities/building';

import { indexAt, positionAt, withCells } from './board';
import type { Board, BuildingCell, Cell, PotionCell, Position } from './types';
import { EMPTY, building, potion } from './types';

/**
 * Слияние (§6): три одинаковые постройки **одной ступени**, стоящие рядом,
 * объединяются в одну постройку следующей ступени. Потиры сливаются по той же
 * лестнице (§8). Багровая ступень — потолок, выше слияния нет.
 *
 * «Стоящие рядом» — **в линию**: от трёх подряд по горизонтали или вертикали,
 * как и тройка плиток; угол из трёх (буква Г) не сливается. Длинная линия и
 * сошедшиеся в одной клетке линии сливаются целиком — как в оригинале.
 *
 * Цена слияния из §6 остаётся в силе: группа клеток превращается в одну, прочие
 * освобождаются, и там теперь пройдёт охотник.
 */
export interface Merge {
  /** Все клетки группы, которые уходят: от трёх и больше. */
  readonly cells: readonly Position[];
  /** Куда встаёт результат. */
  readonly position: Position;
  /** Всегда постройка или потир: слиться может только они. */
  readonly into: Mergeable;
}

const MERGE_SIZE = 3;

/** Ключ «что это» — две клетки сливаются, только если ключи совпадают. */
function mergeKey(cell: Cell): string | null {
  if (cell.kind === 'building') return `building:${cell.building}:${cell.tier}`;
  if (cell.kind === 'potion') return `potion:${cell.tier}`;
  return null;
}

/** Клетки, которые вообще умеют сливаться. */
export type Mergeable = BuildingCell | PotionCell;

/** Что получится ступенью выше. null — багровая, дальше потолок. */
function upgraded(cell: Mergeable): Mergeable | null {
  const tier = nextTier(cell.tier);
  if (tier === null) return null;
  return cell.kind === 'building' ? building(cell.building, tier) : potion(tier);
}

/**
 * Линии от трёх одинаковых подряд: сначала по строкам, потом по столбцам.
 * Так же, как тройки плиток в `match.ts`, — угол линией не считается.
 */
function lines(board: Board): number[][] {
  const found: number[][] = [];

  const scan = (length: number, indexOf: (step: number) => number): void => {
    let start = 0;
    while (start < length) {
      // Индексы строятся по размеру поля, поэтому клетка есть всегда.
      const key = mergeKey(board.cells[indexOf(start)] as Cell);
      let end = start + 1;
      if (key !== null) {
        while (end < length && mergeKey(board.cells[indexOf(end)] as Cell) === key) end++;
      }
      if (key !== null && end - start >= MERGE_SIZE) {
        found.push(Array.from({ length: end - start }, (_, offset) => indexOf(start + offset)));
      }
      start = end;
    }
  };

  for (let y = 0; y < board.height; y++) scan(board.width, (x) => y * board.width + x);
  for (let x = 0; x < board.width; x++) scan(board.height, (y) => y * board.width + x);

  return found;
}

/**
 * Линии, у которых есть общая клетка, — одна группа: Г, Т и крест сливаются
 * целиком, как в оригинале. Линий на поле немного, поэтому честный перебор.
 */
function joinLines(found: readonly number[][]): number[][] {
  const groups: Set<number>[] = [];
  for (const line of found) {
    const merged = new Set<number>(line);
    for (const group of groups.filter((candidate) => line.some((index) => candidate.has(index)))) {
      for (const index of group) merged.add(index);
      groups.splice(groups.indexOf(group), 1);
    }
    groups.push(merged);
  }
  return groups.map((group) => [...group].sort((a, b) => a - b));
}

/**
 * Готовые слияния на поле.
 *
 * Как в оригинале: уходит **вся** группа — линия любой длины от трёх или
 * несколько линий, сошедшихся в одной клетке, — и на её месте встаёт одна
 * постройка ступенью выше.
 *
 * `preferred` — клетки, которые игрок трогал последними, в порядке убывания
 * приоритета: результат встаёт туда же, куда и постройка от тройки. Если игрок
 * ни одной клетки группы не трогал (слияние сложилось само, после гравитации),
 * результат встаёт в середину группы.
 */
export function findMerges(board: Board, preferred: readonly Position[] = []): Merge[] {
  const priority = preferred
    .filter((position) => position.x >= 0 && position.x < board.width)
    .filter((position) => position.y >= 0 && position.y < board.height)
    .map((position) => indexAt(board, position));

  const merges: Merge[] = [];
  for (const group of joinLines(lines(board))) {
    // lines собирает только клетки с ключом слияния, поэтому образец
    // гарантированно постройка или потир.
    const sample = board.cells[group[0] as number] as Mergeable;
    const into = upgraded(sample);
    if (into === null) continue;

    const wanted = priority.find((index) => group.includes(index));
    const position = wanted ?? (group[Math.floor(group.length / 2)] as number);
    merges.push({
      cells: group.map((index) => positionAt(board, index)),
      position: positionAt(board, position),
      into,
    });
  }
  return merges;
}

/** Убрать слившиеся клетки и поставить результат. Исходное поле не трогает. */
export function applyMerges(board: Board, merges: readonly Merge[]): Board {
  const patches: [Position, Cell][] = [];

  for (const merge of merges) {
    for (const cell of merge.cells) patches.push([cell, EMPTY]);
  }
  for (const merge of merges) {
    patches.push([merge.position, merge.into]);
  }

  return withCells(board, patches);
}
