import { afterEach, describe, expect, it } from 'vitest';

import { setLang } from '@/shared/lib/i18n';

import { bonusToast } from './bonusToast';

afterEach(() => {
  setLang('ru');
});

describe('надпись о бонусной крови', () => {
  it('без бонуса — ничего', () => {
    expect((setLang('ru'), bonusToast)(2, 0, 0)).toBeNull();
  });

  it('комбо из трёх — первое имя, из шести и больше — последнее', () => {
    expect((setLang('ru'), bonusToast)(3, 1, 0)?.title).toBe('Хорошее комбо!');
    expect((setLang('ru'), bonusToast)(9, 7, 0)?.title).toBe('Грандиозное комбо!');
    expect((setLang('en'), bonusToast)(4, 2, 0)?.title).toBe('Awesome combo!');
  });

  it('только длинное слияние — своё название', () => {
    expect((setLang('ru'), bonusToast)(1, 0, 3)?.title).toBe('Большое слияние!');
    expect((setLang('en'), bonusToast)(1, 0, 3)?.title).toBe('Big merge!');
  });

  it('сумма — комбо и слияние вместе, с правильной формой слова', () => {
    expect((setLang('ru'), bonusToast)(3, 1, 3)?.detail).toBe('+4 капли крови');
    setLang('en');
    expect((setLang('en'), bonusToast)(3, 1, 0)?.detail).toBe('+1 blood drop');
  });
});
