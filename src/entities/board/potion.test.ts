import { describe, expect, it } from 'vitest';

import { TIERS } from '@/entities/building';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { cellAt, withCells } from './board';
import { canOpenPotion, openPotion } from './potion';
import { potion } from './types';

const board = boardFrom(`
  P s t
  G a f
  b s .
`);

describe('вскрытие потира (§8)', () => {
  it('клетка пустеет, ступень возвращается вызывающему', () => {
    expect(canOpenPotion(board, { x: 0, y: 0 })).toBe(true);
    const result = openPotion(board, { x: 0, y: 0 });
    expect(result.tier).toBe('raw');
    expect(cellAt(result.board, { x: 0, y: 0 }).kind).toBe('empty');
  });

  it('вскрывается потир любой ступени', () => {
    for (const tier of TIERS) {
      const one = withCells(board, [[{ x: 0, y: 0 }, potion(tier)]]);
      expect(openPotion(one, { x: 0, y: 0 }).tier, tier).toBe(tier);
    }
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    openPotion(board, { x: 0, y: 0 });
    expect(pictureOf(board)).toBe(before);
  });
});

describe('что вскрыть нельзя', () => {
  it('сырую плитку', () => {
    expect(canOpenPotion(board, { x: 1, y: 0 })).toBe(false);
  });

  it('постройку', () => {
    expect(canOpenPotion(board, { x: 0, y: 1 })).toBe(false);
  });

  it('пустую клетку', () => {
    expect(canOpenPotion(board, { x: 2, y: 2 })).toBe(false);
  });

  it('клетку за краем поля', () => {
    expect(canOpenPotion(board, { x: 9, y: 9 })).toBe(false);
  });

  it('openPotion бросает, если вскрывать нечего', () => {
    expect(() => openPotion(board, { x: 1, y: 0 })).toThrow();
    expect(() => openPotion(board, { x: 9, y: 9 })).toThrow();
  });
});
