import { describe, expect, it } from 'vitest';

import { BUILDING_ARTS, TIER_ARTS } from './buildings';
import { TIER_TINT } from './tiles';

describe('силуэт постройки', () => {
  it('у каждой ступени — свой цвет (§6)', () => {
    expect(BUILDING_ARTS.length).toBe(4);
    const tints = TIER_ARTS.map((tier) => TIER_TINT[tier]);
    expect(new Set(tints).size).toBe(TIER_ARTS.length);
  });

  it('ступеней ровно четыре, видов ровно четыре', () => {
    expect(TIER_ARTS).toHaveLength(4);
    expect(BUILDING_ARTS).toHaveLength(4);
  });
});
