import type { Board } from '@/entities/board';
import type { BuildingId } from '@/entities/building';

/**
 * Подсказки к первой встрече — уже после обучения: каждая один раз за всё
 * время игры, как в оригинале.
 */
export type TipId = BuildingId | 'potion' | 'turret';

export const TIPS: readonly TipId[] = ['gargoyle', 'vine', 'mortar', 'fogveil', 'potion', 'turret'];

/**
 * Какую подсказку показать сейчас: первый вид постройки или потир, который
 * есть на поле, а подсказки к нему ещё не было; горгулья в верхнем углу —
 * про башню замка. Про босса — не здесь: о нём напоминают каждую его ночь
 * (`app/App.tsx`).
 */
export function nextTip(board: Board, seen: readonly string[]): TipId | null {
  const present = new Set<TipId>();
  board.cells.forEach((cell, index) => {
    if (cell.kind === 'potion') present.add('potion');
    if (cell.kind !== 'building') return;
    present.add(cell.building);
    const x = index % board.width;
    const corner = index < board.width && (x === 0 || x === board.width - 1);
    if (corner && cell.building === 'gargoyle') present.add('turret');
  });
  return TIPS.find((tip) => present.has(tip) && !seen.includes(tip)) ?? null;
}
