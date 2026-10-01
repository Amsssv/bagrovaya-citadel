import type { CitadelLevel, CitadelLevelId } from '@/entities/citadel';
import type { BestRecord, RecordBook } from '@/entities/player';
import { bestOf } from '@/entities/player';

/**
 * Выбор цитадели (§12).
 *
 * Игра — набор цитаделей с разными правилами, а не линейная кампания, поэтому
 * открыты все сразу: ни порядка прохождения, ни условий открытия спека не
 * называет, и придумывать их нельзя.
 *
 * Забег идёт в одной цитадели. Уход в другую его бросает — об этом кнопка
 * говорит прямо, а не после нажатия.
 */
export type PickAction = 'start' | 'restart' | 'abandon';

export interface PickerRow {
  readonly level: CitadelLevel;
  readonly best: BestRecord;
  readonly isCurrent: boolean;
  readonly action: PickAction;
}

export function pickerRows(
  levels: readonly CitadelLevel[],
  current: CitadelLevelId,
  book: RecordBook,
  runInProgress = false,
): PickerRow[] {
  return levels.map((level) => {
    const isCurrent = level.id === current;
    return {
      level,
      best: bestOf(book, level.id),
      isCurrent,
      action: !runInProgress ? 'start' : isCurrent ? 'restart' : 'abandon',
    };
  });
}
