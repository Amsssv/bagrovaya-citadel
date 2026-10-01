import { afterEach, describe, expect, it } from 'vitest';

import { setLang } from '@/shared/lib/i18n';

import { bloodCaption, bloodDrops, dropsWord } from './meter';

describe('капли на шкале', () => {
  it('норма целиком — все капли полные', () => {
    expect(bloodDrops(5, 5)).toEqual({ full: 5, empty: 0, extra: 0 });
  });

  it('потраченные — пустые', () => {
    expect(bloodDrops(2, 5)).toEqual({ full: 2, empty: 3, extra: 0 });
  });

  it('сверх нормы — подписью, а не новыми каплями', () => {
    expect(bloodDrops(17, 5)).toEqual({ full: 5, empty: 0, extra: 12 });
  });

  it('ноль — все пустые', () => {
    expect(bloodDrops(0, 5)).toEqual({ full: 0, empty: 5, extra: 0 });
  });
});

describe('капля, капли, капель', () => {
  it.each([
    [1, 'капля'],
    [2, 'капли'],
    [4, 'капли'],
    [5, 'капель'],
    [11, 'капель'],
    [12, 'капель'],
    [21, 'капля'],
    [22, 'капли'],
    [25, 'капель'],
    [111, 'капель'],
  ])('%i — %s', (count, word) => {
    expect(dropsWord(count)).toBe(word);
  });
});

describe('подпись под шкалой', () => {
  it('говорит, сколько осталось до рассвета', () => {
    expect(bloodCaption(3)).toBe('До рассвета 3 капли');
  });

  it('последняя капля — отдельно: следующий ход последний', () => {
    expect(bloodCaption(1)).toBe('Последняя капля');
  });

  it('ноль — рассвет', () => {
    expect(bloodCaption(0)).toBe('Рассвет');
  });
});

describe('по-английски', () => {
  afterEach(() => {
    setLang('ru');
  });

  it('drop, drops', () => {
    setLang('en');
    expect(dropsWord(1)).toBe('drop');
    expect(dropsWord(21)).toBe('drops');
  });

  it('подпись под шкалой', () => {
    setLang('en');
    expect(bloodCaption(3)).toBe('3 drops until dawn');
    expect(bloodCaption(1)).toBe('Last drop');
    expect(bloodCaption(0)).toBe('Dawn');
  });
});
