import { describe, expect, it } from 'vitest';

import { TIERS, isMaxTier, nextTier, previousTier } from './tier';
import type { Tier } from './tier';

describe('лестница из четырёх ступеней (§6)', () => {
  it('ступени идут от грубой к багровой', () => {
    expect(TIERS).toEqual(['raw', 'bone', 'obsidian', 'crimson']);
  });

  it('каждая ступень поднимается на следующую', () => {
    expect(nextTier('raw')).toBe('bone');
    expect(nextTier('bone')).toBe('obsidian');
    expect(nextTier('obsidian')).toBe('crimson');
  });

  it('багровая — потолок, выше ничего нет', () => {
    expect(nextTier('crimson')).toBeNull();
    expect(isMaxTier('crimson')).toBe(true);
  });

  it('все остальные ступени не потолок', () => {
    for (const tier of ['raw', 'bone', 'obsidian'] as Tier[]) {
      expect(isMaxTier(tier)).toBe(false);
    }
  });

  it('previousTier — обратная операция', () => {
    expect(previousTier('bone')).toBe('raw');
    expect(previousTier('obsidian')).toBe('bone');
    expect(previousTier('crimson')).toBe('obsidian');
  });

  it('ниже грубой ступени нет', () => {
    expect(previousTier('raw')).toBeNull();
  });

  it('nextTier и previousTier ходят по одной лестнице', () => {
    for (const tier of TIERS) {
      const up = nextTier(tier);
      if (up !== null) expect(previousTier(up)).toBe(tier);
    }
  });
});
