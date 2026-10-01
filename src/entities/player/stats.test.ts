import { describe, expect, it } from 'vitest';

import { SCORE_CONFIG } from '@/shared/config/score';

import { computeScore } from './score';
import { EMPTY_STATS, addMove, addNight } from './stats';

describe('счётчики забега', () => {
  it('начинаются с нуля', () => {
    const { defense, ...counters } = EMPTY_STATS;
    expect(Object.values(counters).every((value) => value === 0)).toBe(true);
    expect(Object.values(defense).every((value) => value === 0)).toBe(true);
  });

  it('ночь копит убитых и прорвавшихся', () => {
    const stats = addNight(addNight(EMPTY_STATS, { killed: 3, leaked: 1 }), {
      killed: 2,
      leaked: 0,
    });
    expect(stats.nights).toBe(2);
    expect(stats.enemiesKilled).toBe(5);
    expect(stats.enemiesLeaked).toBe(1);
  });

  it('ход копит слияния, потиры, свапы и предметы', () => {
    const stats = addMove(EMPTY_STATS, {
      merges: 2,
      crimsonMerges: 1,
      potionOpened: true,
      swapsSpent: 1,
      itemUsed: false,
    });
    expect(stats.merges).toBe(2);
    expect(stats.crimsonMerges).toBe(1);
    expect(stats.potionsOpened).toBe(1);
    expect(stats.swapsSpent).toBe(1);
    expect(stats.itemsUsed).toBe(0);
  });

  it('ход предметом считается отдельно от свапа', () => {
    const stats = addMove(EMPTY_STATS, {
      merges: 0,
      crimsonMerges: 0,
      potionOpened: false,
      swapsSpent: 0,
      itemUsed: true,
    });
    expect(stats.itemsUsed).toBe(1);
    expect(stats.swapsSpent).toBe(0);
  });

  it('не трогают исходные счётчики', () => {
    addNight(EMPTY_STATS, { killed: 5, leaked: 5 });
    expect(EMPTY_STATS.nights).toBe(0);
  });
});

describe('очки (§14 #10)', () => {
  const stats = addMove(addNight(EMPTY_STATS, { killed: 10, leaked: 0 }), {
    merges: 4,
    crimsonMerges: 1,
    potionOpened: true,
    swapsSpent: 1,
    itemUsed: false,
  });

  it('формулы в спеке нет — веса сняты с оригинала', () => {
    expect(SCORE_CONFIG.verified).toBe(true);
    expect(computeScore(stats, SCORE_CONFIG.weights)).toBeGreaterThan(0);
  });

  it('с весами складывается взвешенной суммой', () => {
    expect(
      computeScore(stats, { night: 100, kill: 2, merge: 10, crimsonMerge: 50, potion: 5, boss: 0 }),
    ).toBe(100 + 20 + 40 + 50 + 5);
  });

  it('округляется до целого', () => {
    expect(
      computeScore(stats, { night: 0.5, kill: 0.5, merge: 0, crimsonMerge: 0, potion: 0, boss: 0 }),
    ).toBe(6);
  });

  it('спека даёт только меру для сверки, а не сами веса', () => {
    expect(SCORE_CONFIG.checks.strongPlayerCeiling).toBe(5000);
    expect(SCORE_CONFIG.checks.spreadAgainstNovice).toBe(25);
  });
});

describe('очки', () => {
  it('100 за ночь + 1000 за босса + 1 за врага + постройки по ступеням — до единиц', () => {
    const run = {
      ...EMPTY_STATS,
      nights: 23,
      bossesKilled: 2,
      enemiesKilled: 300,
      merges: 40,
      defense: { raw: 4, bone: 3, obsidian: 2, crimson: 1 },
    };
    // 2300 + 2000 + 300 + (4 + 9 + 18 + 27)
    expect(computeScore(run, SCORE_CONFIG.weights)).toBe(4658);
  });

  it('слияние счёт построек не уменьшает: три Грубые стоят одну Костяную', () => {
    const { building } = SCORE_CONFIG.weights;
    expect(3 * building.raw).toBe(building.bone);
    expect(3 * building.bone).toBe(building.obsidian);
    expect(3 * building.obsidian).toBe(building.crimson);
  });

  it('оборона — снимок последней ночи, а не сумма всех', () => {
    const first = addNight(EMPTY_STATS, {
      killed: 1,
      leaked: 0,
      defense: { raw: 5, bone: 0, obsidian: 0, crimson: 0 },
    });
    const second = addNight(first, {
      killed: 1,
      leaked: 0,
      defense: { raw: 2, bone: 1, obsidian: 0, crimson: 0 },
    });
    expect(second.defense).toEqual({ raw: 2, bone: 1, obsidian: 0, crimson: 0 });
    expect(addNight(second, { killed: 0, leaked: 0 }).defense).toEqual(second.defense);
  });

  it('боссы копятся по ночам', () => {
    const once = addNight(EMPTY_STATS, { killed: 11, leaked: 0, bossesKilled: 1 });
    expect(addNight(once, { killed: 3, leaked: 1 }).bossesKilled).toBe(1);
  });
});
