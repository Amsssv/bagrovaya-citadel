import { describe, expect, it } from 'vitest';

import { filterFor } from './filter';

describe('фильтр текстуры по её масштабу на экране', () => {
  it('мельче родного — сглаживать: иначе пиксели рисунка выпадают', () => {
    // Клетка атласа 128 точек на телефоне — около 96 физических пикселей.
    expect(filterFor(96, 128)).toBe('linear');
  });

  it('крупнее родного — без сглаживания: пиксели остаются чёткими', () => {
    expect(filterFor(164, 128)).toBe('nearest');
  });

  it('один в один — без сглаживания', () => {
    expect(filterFor(128, 128)).toBe('nearest');
  });

  it('пустой размер — ничего не решает, остаётся чёткий', () => {
    expect(filterFor(0, 128)).toBe('nearest');
    expect(filterFor(96, 0)).toBe('nearest');
  });
});
