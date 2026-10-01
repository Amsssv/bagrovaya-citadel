import { describe, expect, it } from 'vitest';

import {
  DAY_TINT,
  NIGHT_TINT,
  WATER_COLOR,
  cssColor,
  lightTint,
  mixTint,
  multiplyTint,
  waterColor,
} from './daylight';

describe('смешение тинтов', () => {
  it('на краях отдаёт сами цвета', () => {
    expect(mixTint(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mixTint(0x000000, 0xffffff, 1)).toBe(0xffffff);
  });

  it('каждый канал смешивается отдельно', () => {
    expect(mixTint(0x000000, 0xff8000, 0.5)).toBe(0x804000);
  });

  it('доля за пределами отрезка прижимается к краю', () => {
    expect(mixTint(0x102030, 0x405060, -1)).toBe(0x102030);
    expect(mixTint(0x102030, 0x405060, 2)).toBe(0x405060);
  });
});

describe('свет над полем', () => {
  it('ночь — ночной тинт, день — исходный арт', () => {
    expect(lightTint(0)).toBe(NIGHT_TINT);
    expect(lightTint(1)).toBe(DAY_TINT);
    expect(DAY_TINT).toBe(0xffffff);
  });

  it('ночь темнее дня по каждому каналу', () => {
    for (const shift of [16, 8, 0]) {
      expect((NIGHT_TINT >> shift) & 0xff).toBeLessThan((DAY_TINT >> shift) & 0xff);
    }
  });
});

describe('цвет под освещением', () => {
  it('белый свет не меняет цвет, чёрный гасит', () => {
    expect(multiplyTint(0x2a0e59, 0xffffff)).toBe(0x2a0e59);
    expect(multiplyTint(0x2a0e59, 0x000000)).toBe(0);
  });

  it('каналы перемножаются по отдельности', () => {
    expect(multiplyTint(0xff8040, 0x80ff80)).toBe(0x808020);
  });
});

describe('вода вокруг поля', () => {
  it('днём — цвет воды с картинки поля, без тинта', () => {
    expect(waterColor(1)).toBe(WATER_COLOR);
  });

  it('ночью темнее — под тем же светом, что и поле', () => {
    expect(waterColor(0)).toBe(multiplyTint(WATER_COLOR, NIGHT_TINT));
    expect(cssColor(waterColor(0))).toBe('#19084b');
  });

  it('в CSS — шесть цифр, с ведущими нулями', () => {
    expect(cssColor(0x0000ff)).toBe('#0000ff');
  });
});
