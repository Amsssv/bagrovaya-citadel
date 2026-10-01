import type { ResourceId } from '@/entities/board';

/**
 * Цитадель как уровень (§12).
 *
 * Игра — набор цитаделей с разными правилами, а не линейная кампания. Каждая
 * отличается от Багровой всего двумя параметрами — так и сказано в §12, и это
 * держит развилку в данных, а не в коде: ни ветвлений «если Голодная ночь», ни
 * отдельных реализаций.
 *
 * Не путать с `hearts.ts`: там цитадель как замок — сердца, стена, гнёзда.
 * Здесь — цитадель как уровень, по которому играют.
 */
export type CitadelLevelId = string;

export interface CitadelLevel {
  readonly id: CitadelLevelId;
  readonly name: string;
  readonly hint: string;
  /** Ресурсы, из которых раздаётся и досыпается поле (§5). */
  readonly resources: readonly ResourceId[];
  /** Запас свапов на начало забега. */
  readonly startSwaps: number;
  /** Своя летопись: рекорды цитаделей между собой не сравнивают (§12, §13). */
  readonly leaderboard: string;
}

/** С неё начинают: §12 называет её базой. */
export const DEFAULT_LEVEL_ID = 'crimson';

export function levelById(
  levels: readonly CitadelLevel[],
  id: CitadelLevelId,
): CitadelLevel | null {
  return levels.find((level) => level.id === id) ?? null;
}

/**
 * Будут ли на поле потиры. Потир рождается только из тройки крови (§5), поэтому
 * «потиров нет вообще» у Голодной ночи (§12) — это ровно «крови на поле нет»,
 * а не отдельный запрет.
 */
export function hasPotions(level: CitadelLevel): boolean {
  return level.resources.includes('blood');
}
