import { describe, expect, it } from 'vitest';

import { QUALITIES, planFor } from './quality';

describe('режим качества', () => {
  it('режимов ровно два: полный и низкий', () => {
    expect([...QUALITIES]).toEqual(['high', 'low']);
  });

  it('в низком частиц нет вовсе', () => {
    expect(planFor('low').particles).toBe(false);
    expect(planFor('low').maxEffects).toBe(0);
  });

  it('в полном частицы есть, но с потолком', () => {
    const plan = planFor('high');
    expect(plan.particles).toBe(true);
    // Багровая горгулья бьёт пятнадцать раз в секунду, и таких на поле шесть:
    // без потолка пыль от попаданий завалила бы сцену.
    expect(plan.maxEffects).toBeGreaterThan(0);
    expect(plan.maxEffects).toBeLessThan(64);
  });
});
