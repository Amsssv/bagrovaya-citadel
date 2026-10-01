import type { ScoreWeights } from './score';
import { computeScore } from './score';
import type { RunStats } from './stats';

/**
 * Летопись рекордов (§13).
 *
 * Хранится и на устройстве, и — у авторизованного — в таблице площадки. Аккаунт
 * по §13 даёт летопись, но прогресс всё равно лежит на устройстве, поэтому
 * рекорд обязан быть виден и без регистрации.
 */
export interface BestRecord {
  readonly score: number;
  readonly nights: number;
}

export function recordOf(stats: RunStats, weights: ScoreWeights): BestRecord {
  return { score: computeScore(stats, weights), nights: stats.nights };
}

/** Что из двух записей войдёт в летопись. */
export function betterRecord(current: BestRecord, candidate: BestRecord): BestRecord {
  if (candidate.score > current.score) return candidate;
  // Второй ключ — не украшение: веса очков пока нули (§14 #10), все забеги
  // весят одинаково, и без числа ночей рекорд не сдвинулся бы никогда.
  if (candidate.score === current.score && candidate.nights > current.nights) return candidate;
  return current;
}

/** Летопись целиком: по строке на цитадель (§12 — рекорды у каждой свои). */
export type RecordBook = Readonly<Record<string, BestRecord>>;

export const NO_RECORD: BestRecord = { score: 0, nights: 0 };

export function bestOf(book: RecordBook, id: string): BestRecord {
  return book[id] ?? NO_RECORD;
}

export function withBest(book: RecordBook, id: string, candidate: BestRecord): RecordBook {
  return { ...book, [id]: betterRecord(bestOf(book, id), candidate) };
}
