import { describe, expect, it } from 'vitest';

import { ECONOMY_CONFIG } from '@/shared/config/economy';

import {
  canSpend,
  createPurse,
  grantSwaps,
  isExhausted,
  longMatchBonus,
  spendSwaps,
} from './swaps';

describe('кошелёк свапов', () => {
  it('заводится с начальным запасом', () => {
    const purse = createPurse(20);
    expect(purse.swaps).toBe(20);
    expect(purse.initial).toBe(20);
    expect(purse.spent).toBe(0);
    expect(purse.granted).toBe(0);
  });

  it('отрицательный запас — ошибка', () => {
    expect(() => createPurse(-1)).toThrow();
  });

  it('трата уменьшает запас и копится в счётчике потраченного', () => {
    const purse = spendSwaps(createPurse(20), 3);
    expect(purse.swaps).toBe(17);
    expect(purse.spent).toBe(3);
  });

  it('по умолчанию тратится один', () => {
    expect(spendSwaps(createPurse(20)).swaps).toBe(19);
  });

  it('пополнение увеличивает запас и копится отдельно', () => {
    const purse = grantSwaps(createPurse(5), 12);
    expect(purse.swaps).toBe(17);
    expect(purse.granted).toBe(12);
  });

  it('потолка у запаса нет: Багровый потир даёт четыреста', () => {
    expect(grantSwaps(createPurse(5), 400).swaps).toBe(405);
  });

  it('не трогает исходный кошелёк', () => {
    const purse = createPurse(10);
    spendSwaps(purse, 4);
    grantSwaps(purse, 4);
    expect(purse.swaps).toBe(10);
  });
});

describe('когда тратить нечего', () => {
  it('canSpend видит нехватку', () => {
    expect(canSpend(createPurse(2), 3)).toBe(false);
    expect(canSpend(createPurse(3), 3)).toBe(true);
  });

  it('трата сверх запаса — ошибка, а не уход в минус', () => {
    expect(() => spendSwaps(createPurse(2), 3)).toThrow();
  });

  it('пустой кошелёк — конец ночи (§2)', () => {
    expect(isExhausted(createPurse(0))).toBe(true);
    expect(isExhausted(createPurse(1))).toBe(false);
  });

  it('отрицательные суммы — ошибка в обе стороны', () => {
    expect(() => spendSwaps(createPurse(10), -1)).toThrow();
    expect(() => grantSwaps(createPurse(10), -1)).toThrow();
  });
});

describe('экономика замкнута', () => {
  it('запас всегда равен «начало + выдано − потрачено»', () => {
    let purse = createPurse(30);
    const script: [string, number][] = [
      ['spend', 4],
      ['grant', 12],
      ['spend', 9],
      ['spend', 1],
      ['grant', 70],
      ['spend', 25],
      ['grant', 400],
      ['spend', 100],
    ];

    for (const [action, amount] of script) {
      purse = action === 'spend' ? spendSwaps(purse, amount) : grantSwaps(purse, amount);
      expect(purse.swaps).toBe(purse.initial + purse.granted - purse.spent);
    }

    expect(purse.spent).toBe(139);
    expect(purse.granted).toBe(482);
  });
});

describe('конфиг потиров (§8)', () => {
  it('все ступени сняты с оригинала: 2 · 12 · 70 · 380', () => {
    const tiers = ['raw', 'bone', 'obsidian', 'crimson'] as const;
    expect(tiers.map((tier) => ECONOMY_CONFIG.potions[tier].swaps)).toEqual([2, 12, 70, 380]);
    expect(tiers.every((tier) => ECONOMY_CONFIG.potions[tier].verified)).toBe(true);
  });

  it('разрыв между Костяным и Багровым — в тридцать с лишним раз', () => {
    const ratio = ECONOMY_CONFIG.potions.crimson.swaps / ECONOMY_CONFIG.potions.bone.swaps;
    expect(Math.round(ratio)).toBe(32);
  });

  it('стартовый запас не снят с оригинала — стоит ноль', () => {
    expect(ECONOMY_CONFIG.startSwaps).toBe(0);
  });
});

describe('кровь за длинный матч', () => {
  it('тройка крови не даёт', () => {
    expect(longMatchBonus([3], 4)).toBe(0);
  });

  it('за каждую плитку сверх тройки — капля', () => {
    expect(longMatchBonus([4], 4)).toBe(1);
    expect(longMatchBonus([5], 4)).toBe(2);
    expect(longMatchBonus([6], 4)).toBe(3);
  });

  it('группы одного хода, каскады в том числе, складываются', () => {
    expect(longMatchBonus([3, 4, 5], 4)).toBe(3);
  });

  it('порог из конфига: с пяти четвёрка ничего не даёт', () => {
    expect(longMatchBonus([4, 5], 5)).toBe(1);
  });

  it('нет групп — нет крови', () => {
    expect(longMatchBonus([], 4)).toBe(0);
  });

  it('в конфиге — с четырёх', () => {
    expect(ECONOMY_CONFIG.longMatchFrom).toBe(4);
  });
});
