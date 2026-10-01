import { describe, expect, it } from 'vitest';

import { cssColor } from './tiles';

describe('тинт Phaser в цвет CSS', () => {
  it('шесть знаков, с ведущими нулями', () => {
    expect(cssColor(0xff7a8c)).toBe('#ff7a8c');
    expect(cssColor(0x0000ff)).toBe('#0000ff');
    expect(cssColor(0)).toBe('#000000');
  });
});
