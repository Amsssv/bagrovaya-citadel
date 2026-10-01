import { describe, expect, it } from 'vitest';

import { createCitadel, damageCitadel, isFallen, restoreHearts } from './hearts';

describe('сердца цитадели (§9)', () => {
  it('создаётся с заданным запасом и потолком', () => {
    const citadel = createCitadel(30, 30);
    expect(citadel.hearts).toBe(30);
    expect(citadel.maxHearts).toBe(30);
  });

  it('старт может быть ниже потолка', () => {
    expect(createCitadel(12, 30).hearts).toBe(12);
  });

  it('старт выше потолка обрезается', () => {
    expect(createCitadel(99, 30).hearts).toBe(30);
  });

  it('потолок должен быть положительным', () => {
    expect(() => createCitadel(10, 0)).toThrow();
  });
});

describe('урон', () => {
  const citadel = createCitadel(30, 30);

  it('снимает сердца', () => {
    expect(damageCitadel(citadel, 7).hearts).toBe(23);
  });

  it('ниже нуля не уходит', () => {
    expect(damageCitadel(citadel, 100).hearts).toBe(0);
  });

  it('нулевой урон ничего не меняет', () => {
    expect(damageCitadel(citadel, 0).hearts).toBe(30);
  });

  it('отрицательный урон — ошибка, а не тихое лечение', () => {
    expect(() => damageCitadel(citadel, -5)).toThrow();
  });

  it('не трогает исходную цитадель', () => {
    damageCitadel(citadel, 7);
    expect(citadel.hearts).toBe(30);
  });
});

describe('пополнение', () => {
  it('добавляет сердца', () => {
    expect(restoreHearts(createCitadel(10, 30), 5).hearts).toBe(15);
  });

  it('выше потолка не поднимается — потолок 30 (§9)', () => {
    expect(restoreHearts(createCitadel(28, 30), 10).hearts).toBe(30);
  });

  it('отрицательное пополнение — ошибка', () => {
    expect(() => restoreHearts(createCitadel(10, 30), -1)).toThrow();
  });
});

describe('поражение', () => {
  it('на нуле цитадель пала', () => {
    expect(isFallen(createCitadel(0, 30))).toBe(true);
  });

  it('с одним сердцем ещё держится', () => {
    expect(isFallen(createCitadel(1, 30))).toBe(false);
  });

  it('добивающий урон роняет цитадель', () => {
    expect(isFallen(damageCitadel(createCitadel(3, 30), 3))).toBe(true);
  });
});
