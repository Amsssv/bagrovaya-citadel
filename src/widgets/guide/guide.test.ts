import { afterEach, describe, expect, it } from 'vitest';

import { HARVEST, building, potion, tile } from '@/entities/board';
import type { ResourceId } from '@/entities/board';
import { TIERS } from '@/entities/building';
import { LANGS, setLang } from '@/shared/lib/i18n';

import { GUIDE_TABS, describeCell, ladderRows, listNights, matchRows } from './guide';

describe('таблица троек', () => {
  it('на каждый ресурс домена — ровно одна строка, в порядке домена', () => {
    const resources = Object.keys(HARVEST) as ResourceId[];
    expect(matchRows().map((row) => row.resource)).toEqual(resources);
  });

  it('тройка даёт то же, что и в домене', () => {
    for (const row of matchRows()) {
      expect(row.yields).toBe(HARVEST[row.resource]);
    }
  });

  it.each(LANGS)('у каждой строки есть название плитки, итога и роль (%s)', (lang) => {
    setLang(lang);
    for (const row of matchRows()) {
      expect(row.tileName).not.toBe('');
      expect(row.resultName).not.toBe('');
      expect(row.role).not.toBe('');
    }
  });

  afterEach(() => {
    setLang('ru');
  });
});

describe('лестница ступеней', () => {
  it('идёт по доменным ступеням снизу вверх', () => {
    expect(ladderRows().map((row) => row.tier)).toEqual([...TIERS]);
  });
});

describe('ночи боссов по-русски', () => {
  it('перечисляет через запятую и «и»', () => {
    expect(listNights([10, 20, 30, 40, 50])).toBe('10, 20, 30, 40 и 50');
  });

  it('одна ночь — без союза', () => {
    expect(listNights([10])).toBe('10');
  });

  it('пустой список — пустая строка', () => {
    expect(listNights([])).toBe('');
  });
});

describe('ночи боссов по-английски', () => {
  afterEach(() => {
    setLang('ru');
  });

  it('перечисляет через запятую и «and»', () => {
    setLang('en');
    expect(listNights([10, 20, 30])).toBe('10, 20 and 30');
  });
});

describe('разделы', () => {
  it('ключи разделов не повторяются', () => {
    const ids = GUIDE_TABS.map((tab) => tab.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('описание клетки по долгому нажатию', () => {
  it('постройка: название со ступенью, дело и цифры ступени', () => {
    setLang('ru');
    const info = describeCell(building('gargoyle', 'bone'));
    expect(info?.title).toBe('Горгулья · Костяная');
    expect(info?.text).toContain('в своей и соседних клетках');
    expect(info?.stats).toBe('Урон 3 · 2,61 выстр./с');
    setLang('en');
    expect(describeCell(building('gargoyle', 'bone'))?.stats).toBe('Damage 3 · 2.61 shots/s');
    expect(info?.frame).toBe('gargoyle-bone');
  });

  it('завеса — замедление вместо урона', () => {
    setLang('ru');
    expect(describeCell(building('fogveil', 'raw'))?.stats).toBe('Замедляет на 54 %');
  });

  it('потир — сколько крови внутри', () => {
    setLang('ru');
    const info = describeCell(potion('bone'));
    expect(info?.title).toBe('Костяной потир');
    expect(info?.stats).toBe('Внутри: 12 капель крови');
  });

  it('плитка — во что превратится', () => {
    setLang('en');
    const info = describeCell(tile('thorn'));
    expect(info?.title).toBe('Poison thorn');
    expect(info?.text).toBe('Three in a row make: predatory vine.');
    expect(info?.stats).toBe('');
  });

  it('пустая клетка — описывать нечего', () => {
    expect(describeCell({ kind: 'empty' })).toBeNull();
  });
});
