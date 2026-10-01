import { afterEach, describe, expect, it } from 'vitest';

import { getLang, resolveLang, setLang } from './lang';
import { levelHint, levelName } from './levels';

afterEach(() => {
  setLang('ru');
});

describe('язык от площадки', () => {
  it.each([
    ['ru', 'ru'],
    ['en', 'en'],
    ['be', 'ru'],
    ['kk', 'ru'],
    ['uk', 'ru'],
    ['uz', 'ru'],
    ['tr', 'en'],
    ['de', 'en'],
    ['en-US', 'en'],
    ['RU', 'ru'],
    ['ru_RU', 'ru'],
  ] as const)('%s → %s', (raw, lang) => {
    expect(resolveLang(raw)).toBe(lang);
  });

  it('пусто или нет вовсе — русский', () => {
    expect(resolveLang('')).toBe('ru');
    expect(resolveLang(null)).toBe('ru');
    expect(resolveLang(undefined)).toBe('ru');
  });
});

describe('текущий язык', () => {
  it('по умолчанию русский, меняется выбором', () => {
    expect(getLang()).toBe('ru');
    setLang('en');
    expect(getLang()).toBe('en');
  });
});

describe('имена цитаделей', () => {
  const crimson = { id: 'crimson', name: 'Багровая', hint: 'База' };
  const unknown = { id: 'nope', name: 'Безымянная', hint: 'Без перевода' };

  it('по-русски — из словаря', () => {
    expect(levelName(crimson)).toBe('Багровая');
    expect(levelHint(crimson)).toBe('База: шесть столбцов, обычная экономика');
  });

  it('по-английски — перевод', () => {
    setLang('en');
    expect(levelName(crimson)).toBe('Crimson');
  });

  it('цитадели нет в словаре — имя из её конфига, а не ключ и не пустота', () => {
    setLang('en');
    expect(levelName(unknown)).toBe('Безымянная');
    expect(levelHint(unknown)).toBe('Без перевода');
  });
});
