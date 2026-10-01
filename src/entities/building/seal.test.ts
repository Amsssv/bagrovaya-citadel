import { describe, expect, it } from 'vitest';

import { SEALS, canSealTier, sealRaises, sealTier } from './seal';
import type { SealId } from './seal';
import { TIERS } from './tier';

describe('печати крови (§6)', () => {
  it('печатей три — по одной на каждый подъём', () => {
    expect(SEALS).toEqual(['bone', 'obsidian', 'crimson']);
  });

  it('каждая печать поднимает ровно с предыдущей ступени на свою', () => {
    expect(sealRaises('bone')).toEqual({ from: 'raw', to: 'bone' });
    expect(sealRaises('obsidian')).toEqual({ from: 'bone', to: 'obsidian' });
    expect(sealRaises('crimson')).toEqual({ from: 'obsidian', to: 'crimson' });
  });

  it('печать поднимает одну постройку, не требуя трёх', () => {
    expect(sealTier('raw', 'bone')).toBe('bone');
    expect(sealTier('bone', 'obsidian')).toBe('obsidian');
    expect(sealTier('obsidian', 'crimson')).toBe('crimson');
  });
});

describe('печать не подходит к ступени', () => {
  it('костяная печать не берёт костяную постройку', () => {
    expect(canSealTier('bone', 'bone')).toBe(false);
  });

  it('обсидиановая печать не перепрыгивает через ступень', () => {
    expect(canSealTier('raw', 'obsidian')).toBe(false);
  });

  it('багровую постройку поднять нечем — это потолок', () => {
    for (const seal of SEALS) {
      expect(canSealTier('crimson', seal)).toBe(false);
    }
  });

  it('неподходящая печать бросает, а не поднимает молча', () => {
    expect(() => sealTier('bone', 'bone')).toThrow();
    expect(() => sealTier('crimson', 'crimson')).toThrow();
  });

  it('к каждой ступени подходит ровно одна печать', () => {
    for (const tier of TIERS) {
      const fitting = SEALS.filter((seal) => canSealTier(tier, seal));
      expect(fitting.length, `ступень ${tier}`).toBe(tier === 'crimson' ? 0 : 1);
    }
  });

  it('подходящая печать называется так же, как ступень, на которую поднимает', () => {
    for (const tier of TIERS) {
      const fitting = SEALS.filter((seal) => canSealTier(tier, seal));
      const seal = fitting[0] as SealId | undefined;
      if (seal !== undefined) expect(sealTier(tier, seal)).toBe(seal);
    }
  });
});
