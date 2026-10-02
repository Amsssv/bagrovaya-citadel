import { afterEach, describe, expect, it } from 'vitest';

import { setLang } from './lang';
import en from './locales/en.json';
import ru from './locales/ru.json';
import type { MessageKey } from './translate';
import { keysOf, t } from './translate';

afterEach(() => {
  setLang('ru');
});

const valueOf = (dictionary: unknown, key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], dictionary);

/** Подстановки строки или склонения: `{count}`, `{name}`. */
const placeholders = (value: unknown): string[] =>
  [...JSON.stringify(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();

describe('словари', () => {
  it('в английском те же ключи, что в русском, — ни лишних, ни пропущенных', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(ru).sort());
  });

  it('пустых строк нет', () => {
    for (const dictionary of [ru, en]) {
      for (const key of keysOf(dictionary)) {
        expect(JSON.stringify(valueOf(dictionary, key)), key).not.toMatch(/""/);
      }
    }
  });

  it('подстановки в переводе те же, что в оригинале', () => {
    for (const key of keysOf(ru)) {
      expect(placeholders(valueOf(en, key)), key).toEqual(placeholders(valueOf(ru, key)));
    }
  });

  it('у склонений все формы: одна, несколько, много — и one, other', () => {
    for (const key of keysOf(ru)) {
      const value = valueOf(ru, key);
      if (typeof value !== 'object' || value === null) continue;
      expect(Object.keys(value).sort(), key).toEqual(['few', 'many', 'one']);
      expect(Object.keys(valueOf(en, key) as object).sort(), key).toEqual(['one', 'other']);
    }
  });
});

describe('перевод по ключу', () => {
  it('строка на текущем языке', () => {
    expect(t('app.night')).toBe('Ночь');
    setLang('en');
    expect(t('app.night')).toBe('Night');
  });

  it('подстановки', () => {
    expect(t('app.victory.title', { night: 10 })).toBe('Глашатай пал! 10-й рассвет пережит');
    // Чего не передали — остаётся как было, а не пропадает молча.
    expect(t('app.victory.title')).toContain('{night}');
    expect(t('app.victory.title', { other: 1 })).toContain('{night}');
  });

  it('склонение по числу: по-русски три формы, по-английски две', () => {
    expect([1, 3, 5, 21, 12].map((count) => t('plural.nights', { count }))).toEqual([
      'ночь',
      'ночи',
      'ночей',
      'ночь',
      'ночей',
    ]);
    setLang('en');
    expect([0, 1, 2].map((count) => t('plural.drops', { count }))).toEqual([
      'drops',
      'drop',
      'drops',
    ]);
  });

  it('склонение без числа — как для нуля', () => {
    expect(t('plural.drops')).toBe('капель');
  });

  it('ключа нет — сам ключ, чтобы пропуск было видно', () => {
    expect(t('nope.missing' as MessageKey)).toBe('nope.missing');
    expect(t('app' as MessageKey)).toBe('app');
  });

  it('нет перевода — русская строка', () => {
    setLang('en');
    // Настоящих пропусков словари не допускают (тест выше), поэтому проверяем
    // запасной путь на ключе, которого нет только в английском.
    const lonely = 'test.onlyRu' as MessageKey;
    (ru as Record<string, unknown>)['test'] = { onlyRu: 'только по-русски' };
    expect(t(lonely)).toBe('только по-русски');
    delete (ru as Record<string, unknown>)['test'];
  });
});
