import { describe, expect, it } from 'vitest';

import { ENEMY_BOOK } from '@/shared/config/enemies';

import { cellOf, specFor, statsAt, unverifiedHunters } from './enemy';
import type { EnemyBook, EnemySpec } from './enemy';

const BOOK: EnemyBook = {
  novice: { hp: 10, speed: 1, citadelDamage: 2, verified: false },
  hound: { hp: 6, speed: 2, citadelDamage: 1, verified: true },
};

describe('справочник охотников', () => {
  it('достаёт характеристики по виду', () => {
    expect(specFor(BOOK, 'hound').speed).toBe(2);
  });

  it('неизвестный вид — ошибка, а не тихий undefined', () => {
    expect(() => specFor(BOOK, 'нет-такого')).toThrow(/нет-такого/);
  });

  it('перечисляет тех, чьи цифры не сняты', () => {
    expect(unverifiedHunters(BOOK)).toEqual(['novice']);
  });

  it('в балансе три вида — солдат, священник и паладин после пятидесятой ночи', () => {
    expect(Object.keys(ENEMY_BOOK).sort()).toEqual(['hunter', 'paladin', 'preacher']);
  });

  it('все сняты с оригинала', () => {
    expect(unverifiedHunters(ENEMY_BOOK)).toEqual([]);
  });

  it('босс медленнее солдата и не сносится — как в оригинале', () => {
    const soldier = statsAt(ENEMY_BOOK['hunter'] as EnemySpec, 10);
    const boss = statsAt(ENEMY_BOOK['preacher'] as EnemySpec, 10);
    expect(boss.speed).toBeLessThan(soldier.speed);
    expect(boss.knockback).toBe(0);
    expect(soldier.knockback).toBeGreaterThan(0);
  });
});

describe('где охотник стоит', () => {
  it('клетка — округление дробной координаты', () => {
    expect(cellOf({ id: 'a', kind: 'novice', column: 2, y: 3.4, hp: 10 }, 6)).toBe(3);
    expect(cellOf({ id: 'a', kind: 'novice', column: 2, y: 3.6, hp: 10 }, 6)).toBe(4);
  });

  it('за верхним краем прижимается к ряду у цитадели', () => {
    expect(cellOf({ id: 'a', kind: 'novice', column: 2, y: -0.7, hp: 10 }, 6)).toBe(0);
  });

  it('за нижним краем прижимается к нижнему ряду', () => {
    expect(cellOf({ id: 'a', kind: 'novice', column: 2, y: 9, hp: 10 }, 6)).toBe(5);
  });
});

describe('враг растёт от ночи к ночи', () => {
  const soldier = {
    hp: 6,
    speed: 0.875,
    speedGrowthPerNight: 0.013,
    citadelDamage: 1,
    verified: true,
  };
  const boss = {
    hp: -13,
    hpPerNight: 11,
    lateFromNight: 40,
    lateHpBonus: 99,
    speed: 0.875,
    citadelDamage: 1,
    verified: false,
  };

  it('скорость растёт на долю за ночь, жизни без роста не меняются', () => {
    expect(statsAt(soldier, 0).speed).toBeCloseTo(0.875);
    expect(statsAt(soldier, 50).speed).toBeCloseTo(0.875 * 1.65);
    expect(statsAt(soldier, 50).hp).toBe(6);
  });

  it('жизни босса — 11 × ночь − 13, после сороковой ещё +99', () => {
    expect([10, 20, 30, 40, 50].map((night) => statsAt(boss, night).hp)).toEqual([
      97, 207, 317, 427, 636,
    ]);
  });

  it('жизней не меньше одной, даже если формула уходит в минус', () => {
    expect(statsAt(boss, 1).hp).toBe(1);
  });

  it('без полей роста враг одинаков в любую ночь', () => {
    const plain = { hp: 10, speed: 1, citadelDamage: 2, verified: false };
    expect(statsAt(plain, 30)).toEqual({ hp: 10, speed: 1, citadelDamage: 2, knockback: 0 });
  });
});

describe('поздняя надбавка без бонуса', () => {
  it('ночь поздней надбавки задана, а сама надбавка нет — жизни не растут', () => {
    const spec = { hp: 5, lateFromNight: 3, speed: 1, citadelDamage: 1, verified: false };
    expect(statsAt(spec, 10).hp).toBe(5);
  });
});

describe('поздний босс быстрее', () => {
  it('после ночи lateFromNight скорость умножается на lateSpeedFactor', () => {
    const boss = {
      hp: 1,
      speed: 1,
      lateFromNight: 40,
      lateSpeedFactor: 1.3,
      citadelDamage: 1,
      verified: false,
    };
    expect(statsAt(boss, 40).speed).toBe(1);
    expect(statsAt(boss, 41).speed).toBeCloseTo(1.3);
  });

  it('отбрасывание берётся из характеристик', () => {
    expect(
      statsAt({ hp: 1, speed: 1, knockback: 0.03, citadelDamage: 1, verified: false }, 1).knockback,
    ).toBe(0.03);
  });
});
