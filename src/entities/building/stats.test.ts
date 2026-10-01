import { describe, expect, it } from 'vitest';

import { BUILDING_BOOK } from '@/shared/config/buildings';

import { BUILDINGS } from './kind';
import { isDirectional, specFor, statsFor, unverifiedBuildings } from './stats';
import { TIERS } from './tier';

describe('горгулья — единственная, чьи цифры известны (§6)', () => {
  it('урон не меняется со ступенью: растёт скорострельность', () => {
    const damage = TIERS.map((tier) => statsFor(BUILDING_BOOK, 'gargoyle', tier).damage);
    expect(damage).toEqual([3, 3, 3, 3]);
  });

  it('скорострельность по ступеням — из таблицы §6', () => {
    const rate = TIERS.map((tier) => statsFor(BUILDING_BOOK, 'gargoyle', tier).shotsPerSecond);
    expect(rate).toEqual([1.09, 2.61, 6.28, 15]);
  });

  it('от грубой к багровой темп растёт почти в четырнадцать раз', () => {
    const raw = statsFor(BUILDING_BOOK, 'gargoyle', 'raw').shotsPerSecond;
    const crimson = statsFor(BUILDING_BOOK, 'gargoyle', 'crimson').shotsPerSecond;
    expect(crimson / raw).toBeGreaterThan(13);
    expect(crimson / raw).toBeLessThan(15);
  });

  it('радиус не меняется ни разу — одна клетка', () => {
    const range = TIERS.map((tier) => statsFor(BUILDING_BOOK, 'gargoyle', tier).range);
    expect(range).toEqual([1, 1, 1, 1]);
  });
});

describe('схемы огня (§7)', () => {
  it('горгулья бьёт во все стороны', () => {
    expect(specFor(BUILDING_BOOK, 'gargoyle').pattern).toBe('around');
  });

  it('лоза бьёт одну цель по всему своему столбцу', () => {
    expect(specFor(BUILDING_BOOK, 'vine').pattern).toBe('column');
    expect(specFor(BUILDING_BOOK, 'vine').targets).toBe('one');
  });

  it('мортира бьёт одну цель по всему своему ряду', () => {
    expect(specFor(BUILDING_BOOK, 'mortar').pattern).toBe('row');
    expect(specFor(BUILDING_BOOK, 'mortar').targets).toBe('one');
  });

  it('туман не стреляет вовсе', () => {
    expect(specFor(BUILDING_BOOK, 'fogveil').pattern).toBe('none');
  });

  it('преград нет ни у кого: лоза и мортира бьют сквозь постройки', () => {
    const blocked = BUILDINGS.filter((kind) => specFor(BUILDING_BOOK, kind).blockedByBuildings);
    expect(blocked).toEqual([]);
  });

  it('все смотрят вниз, навстречу охотникам', () => {
    for (const kind of BUILDINGS) {
      expect(specFor(BUILDING_BOOK, kind).defaultFacing, kind).toBe('down');
    }
  });
});

describe('что ещё не снято с оригинала', () => {
  it('с оригинала сняты все четыре постройки', () => {
    expect(unverifiedBuildings(BUILDING_BOOK)).toEqual([]);
  });

  it('завеса замедляет, как в оригинале, в полосе с 10 % по 60 % клетки', () => {
    expect(specFor(BUILDING_BOOK, 'fogveil').slowZone).toEqual([0.1, 0.6]);
  });

  it('цель: горгулья — ближайшую, лоза — по вертикали, мортира — ближайшую по ряду с любой стороны', () => {
    expect(specFor(BUILDING_BOOK, 'gargoyle').targeting).toBe('nearest');
    expect(specFor(BUILDING_BOOK, 'vine').targeting).toBe('vertical');
    expect(specFor(BUILDING_BOOK, 'mortar').targeting).toBe('horizontal');
  });

  it('лоза и мортира со ступенью стреляют в 2,4 раза чаще, урон тот же — как в оригинале', () => {
    for (const kind of ['vine', 'mortar'] as const) {
      const rates = TIERS.map((tier) => statsFor(BUILDING_BOOK, kind, tier).shotsPerSecond);
      for (let i = 1; i < rates.length; i++) {
        expect((rates[i] as number) / (rates[i - 1] as number)).toBeCloseTo(2.4, 2);
      }
      expect(new Set(TIERS.map((tier) => statsFor(BUILDING_BOOK, kind, tier).damage)).size).toBe(1);
    }
  });

  it('непроверенные делают своё дело: стреляющие стреляют, завеса замедляет', () => {
    // Цифры выдуманы (balance.ts, ⚠️), но нулей быть не должно: постройка на
    // нулях в бою молча ничего не делает, и игрок решит, что она сломана.
    for (const kind of unverifiedBuildings(BUILDING_BOOK)) {
      for (const tier of TIERS) {
        const stats = statsFor(BUILDING_BOOK, kind, tier);
        const works =
          specFor(BUILDING_BOOK, kind).pattern === 'none'
            ? stats.slowFactor > 0
            : stats.damage > 0 && stats.shotsPerSecond > 0;
        expect(works, `${kind}/${tier}`).toBe(true);
      }
    }
  });

  it('проверенные не стоят на нулях — иначе флаг соврал', () => {
    const verified = BUILDINGS.filter((kind) => specFor(BUILDING_BOOK, kind).verified);
    expect(verified.length).toBeGreaterThan(0);
    for (const kind of verified) {
      for (const tier of TIERS) {
        const stats = statsFor(BUILDING_BOOK, kind, tier);
        // Завеса не стреляет — её дело замедлять.
        if (specFor(BUILDING_BOOK, kind).pattern === 'none') {
          expect(stats.slowFactor, `${kind}/${tier}`).toBeGreaterThan(0);
          continue;
        }
        expect(stats.damage, `${kind}/${tier}`).toBeGreaterThan(0);
        expect(stats.shotsPerSecond, `${kind}/${tier}`).toBeGreaterThan(0);
        expect(stats.range, `${kind}/${tier}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('у кого есть направление (§9)', () => {
  it('лоза и мортира бьют всю линию в обе стороны — разворачивать нечего', () => {
    expect(isDirectional(specFor(BUILDING_BOOK, 'mortar').pattern)).toBe(false);
    expect(isDirectional(specFor(BUILDING_BOOK, 'vine').pattern)).toBe(false);
  });

  it('направленными остаются только прежние лучи', () => {
    expect(isDirectional('single')).toBe(true);
    expect(isDirectional('beam')).toBe(true);
  });

  it('горгулья и туман — нет: от поворота у них ничего не меняется', () => {
    expect(isDirectional(specFor(BUILDING_BOOK, 'gargoyle').pattern)).toBe(false);
    expect(isDirectional(specFor(BUILDING_BOOK, 'fogveil').pattern)).toBe(false);
  });
});
