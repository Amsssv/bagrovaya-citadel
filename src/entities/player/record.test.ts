import { describe, expect, it } from 'vitest';

import { EMPTY_STATS } from './stats';
import type { ScoreWeights } from './score';
import type { RecordBook } from './record';
import { NO_RECORD, bestOf, betterRecord, recordOf, withBest } from './record';

const WEIGHTS: ScoreWeights = { night: 10, kill: 1, merge: 0, crimsonMerge: 0, potion: 0, boss: 0 };

describe('запись забега в летопись', () => {
  it('берёт очки по весам и число ночей из счётчиков', () => {
    const stats = { ...EMPTY_STATS, nights: 7, enemiesKilled: 5 };
    expect(recordOf(stats, WEIGHTS)).toEqual({ score: 75, nights: 7 });
  });
});

describe('сравнение с прошлым рекордом', () => {
  it('первый забег становится рекордом', () => {
    expect(betterRecord({ score: 0, nights: 0 }, { score: 40, nights: 4 })).toEqual({
      score: 40,
      nights: 4,
    });
  });

  it('худший забег рекорд не затирает', () => {
    expect(betterRecord({ score: 90, nights: 9 }, { score: 40, nights: 4 })).toEqual({
      score: 90,
      nights: 9,
    });
  });

  it('при равных очках рекордом считается более долгий забег', () => {
    // Веса очков пока нули (§14 #10): без второго ключа летопись не сдвинулась
    // бы никогда.
    expect(betterRecord({ score: 0, nights: 3 }, { score: 0, nights: 8 })).toEqual({
      score: 0,
      nights: 8,
    });
  });

  it('при равных очках короткий забег рекорд не затирает', () => {
    expect(betterRecord({ score: 0, nights: 8 }, { score: 0, nights: 3 })).toEqual({
      score: 0,
      nights: 8,
    });
  });
});

describe('летопись по цитаделям', () => {
  const book: RecordBook = { crimson: { score: 90, nights: 9 } };

  it('в пустой летописи рекорда нет, но и нулём это не ломается', () => {
    expect(bestOf({}, 'crimson')).toEqual(NO_RECORD);
  });

  it('рекорд соседней цитадели за свой не выдаётся: их не сравнивают (§12)', () => {
    expect(bestOf(book, 'ash-crypt')).toEqual(NO_RECORD);
    expect(bestOf(book, 'crimson')).toEqual({ score: 90, nights: 9 });
  });

  it('запись кладёт лучшее и не трогает соседей', () => {
    const next = withBest(book, 'ash-crypt', { score: 30, nights: 3 });
    expect(next).toEqual({
      crimson: { score: 90, nights: 9 },
      'ash-crypt': { score: 30, nights: 3 },
    });
  });

  it('худший результат свою же строку не затирает', () => {
    expect(withBest(book, 'crimson', { score: 10, nights: 1 })).toEqual(book);
  });
});
