import { describe, expect, it } from 'vitest';

import { createRng } from '@/shared/lib/rng';

import type { BossPlan } from './boss';
import type { NightWavePlan, RegularWavePlan } from './plan';
import { columnLength, nightWave, regularCount, regularWave } from './plan';

const COLUMNS = 6;
const REGULAR: RegularWavePlan = {
  kind: 'hunter',
  perNight: 2.6,
  base: 2,
  spreadEveryNights: 14,
  late: { fromNight: 50, kind: 'paladin', factor: 0.4, minus: 10, perNight: 13, spreadFactor: 0.8 },
};
const BOSS: BossPlan = {
  nights: [10],
  preachers: [
    { kind: 'preacher', flockKind: 'hunter', flockSize: 3, flockDelaySeconds: 1, flockSpread: 1 },
  ],
};
const PLAN: NightWavePlan = { regular: REGULAR, boss: BOSS, secondsPerCell: 1.5 };

describe('рост обычной волны — как в оригинале', () => {
  it('⌈2,6 × ночь⌉ + 2', () => {
    expect([1, 2, 3, 4, 5, 9].map((night) => regularCount(REGULAR, night))).toEqual([
      5, 8, 10, 13, 15, 26,
    ]);
  });

  it('без поздней формулы и после пятидесятой — прежняя', () => {
    const plain: RegularWavePlan = { ...REGULAR, late: undefined };
    expect(regularCount(plain, 60)).toBe(Math.ceil(2.6 * 60) + 2);
  });
});

describe('обычная волна — колонной, как в оригинале', () => {
  it('выходят все, растянутые по высоте: последний — на длину колонны позже', () => {
    const spawns = regularWave(REGULAR, 14, COLUMNS, createRng(1), 1.5);
    expect(spawns).toHaveLength(regularCount(REGULAR, 14));
    // Колонна на 14-ю ночь — две клетки: последний выходит через 2 × 1,5 с.
    expect(spawns.at(-1)?.atSecond).toBeCloseTo(3);
    const times = spawns.map((spawn) => spawn.atSecond);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('столбцы случайные — в одном столбце могут идти несколько', () => {
    const spawns = regularWave(REGULAR, 9, COLUMNS, createRng(1), 1.5);
    expect(spawns.every((spawn) => spawn.column >= 0 && spawn.column < COLUMNS)).toBe(true);
    expect(new Set(spawns.map((spawn) => spawn.column)).size).toBeLessThan(spawns.length);
  });

  it('на одном сиде — один и тот же состав', () => {
    expect(regularWave(REGULAR, 7, COLUMNS, createRng(3), 1.5)).toEqual(
      regularWave(REGULAR, 7, COLUMNS, createRng(3), 1.5),
    );
  });
});

describe('после пятидесятой ночи', () => {
  it('число врагов по поздней формуле: меньше в начале, +13 за ночь', () => {
    // ⌈2,6 × 51⌉ + 2 = 135 → ⌈0,4 × 135⌉ − 10 = 44, и +13 за одну ночь сверх 50.
    expect(regularCount(REGULAR, 51)).toBe(57);
  });

  it('идут враги позднего вида, колонна плотнее', () => {
    const spawns = regularWave(REGULAR, 51, COLUMNS, createRng(1), 1);
    expect(spawns.every((spawn) => spawn.kind === 'paladin')).toBe(true);
    expect(columnLength(REGULAR, 51)).toBeCloseTo((51 / 14 + 1) * 0.8);
  });

  it('до пятидесятой — обычный вид и обычная колонна', () => {
    expect(regularWave(REGULAR, 49, COLUMNS, createRng(1), 1)[0]?.kind).toBe('hunter');
    expect(columnLength(REGULAR, 49)).toBeCloseTo(49 / 14 + 1);
  });
});

describe('ночь босса', () => {
  it('вместо обычной волны — проповедник и паства', () => {
    const { spawns } = nightWave(PLAN, 10, COLUMNS, createRng(1));
    expect(spawns.map((spawn) => spawn.kind)).toEqual(['preacher', 'hunter', 'hunter', 'hunter']);
  });

  it('в обычную ночь босса нет', () => {
    const { spawns } = nightWave(PLAN, 9, COLUMNS, createRng(1));
    expect(spawns.some((spawn) => spawn.kind === 'preacher')).toBe(false);
  });

  it('враги к ночи ускорились — колонна растягивается на те же клетки', () => {
    const fast: NightWavePlan = { ...PLAN, speedGrowthPerNight: 0.5 };
    const slowLast = nightWave(PLAN, 2, COLUMNS, createRng(1)).spawns.at(-1)?.atSecond ?? 0;
    const fastLast = nightWave(fast, 2, COLUMNS, createRng(1)).spawns.at(-1)?.atSecond ?? 0;
    // На вторую ночь скорость вдвое выше — колонна проходится вдвое быстрее.
    expect(fastLast).toBeCloseTo(slowLast / 2);
  });
});
