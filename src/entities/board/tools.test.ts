import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { cellAt } from './board';
import { blast, canBlast, canPlace, canTeleport, place, teleport } from './tools';
import { building, tile } from './types';

const board = boardFrom(`
  s t a
  G P f
  b s .
`);

describe('проклятый прах подрывает клетку (§11)', () => {
  it('клетка пустеет', () => {
    expect(canBlast(board, { x: 0, y: 0 })).toBe(true);
    expect(cellAt(blast(board, { x: 0, y: 0 }), { x: 0, y: 0 }).kind).toBe('empty');
  });

  it('берёт и постройку, и потир — прах не разбирает', () => {
    expect(canBlast(board, { x: 0, y: 1 })).toBe(true);
    expect(canBlast(board, { x: 1, y: 1 })).toBe(true);
  });

  it('пустую клетку подрывать нечего', () => {
    expect(canBlast(board, { x: 2, y: 2 })).toBe(false);
  });

  it('за краем поля — нельзя', () => {
    expect(canBlast(board, { x: 9, y: 9 })).toBe(false);
  });

  it('blast бросает, если подрывать нечего', () => {
    expect(() => blast(board, { x: 2, y: 2 })).toThrow();
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    blast(board, { x: 0, y: 0 });
    expect(pictureOf(board)).toBe(before);
  });
});

describe('нетопыри меняют местами две клетки (§11)', () => {
  it('меняют что угодно, и не только соседнее', () => {
    expect(canTeleport(board, { x: 0, y: 0 }, { x: 2, y: 1 })).toBe(true);
    const next = teleport(board, { x: 0, y: 0 }, { x: 2, y: 1 });
    expect(cellAt(next, { x: 0, y: 0 })).toEqual(tile('fog'));
    expect(cellAt(next, { x: 2, y: 1 })).toEqual(tile('stone'));
  });

  it('постройку тоже переносят', () => {
    const next = teleport(board, { x: 0, y: 1 }, { x: 2, y: 0 });
    expect(cellAt(next, { x: 2, y: 0 })).toEqual(building('gargoyle', 'raw'));
  });

  it('клетку саму с собой менять бессмысленно', () => {
    expect(canTeleport(board, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });

  it('за краем поля — нельзя', () => {
    expect(canTeleport(board, { x: 0, y: 0 }, { x: 9, y: 9 })).toBe(false);
  });

  it('teleport бросает, если обмен запрещён', () => {
    expect(() => teleport(board, { x: 0, y: 0 }, { x: 0, y: 0 })).toThrow();
  });
});

describe('столб тумана ставится из инвентаря (§11)', () => {
  const veil = building('fogveil', 'raw');

  it('встаёт на сырую плитку', () => {
    expect(canPlace(board, { x: 0, y: 0 })).toBe(true);
    expect(cellAt(place(board, { x: 0, y: 0 }, veil), { x: 0, y: 0 })).toEqual(veil);
  });

  it('встаёт в пустую клетку', () => {
    expect(canPlace(board, { x: 2, y: 2 })).toBe(true);
  });

  it('поверх постройки не встаёт: она молча пропала бы', () => {
    expect(canPlace(board, { x: 0, y: 1 })).toBe(false);
  });

  it('поверх потира тоже не встаёт', () => {
    expect(canPlace(board, { x: 1, y: 1 })).toBe(false);
  });

  it('за краем поля — нельзя', () => {
    expect(canPlace(board, { x: 9, y: 9 })).toBe(false);
  });

  it('place бросает, если ставить некуда', () => {
    expect(() => place(board, { x: 0, y: 1 }, veil)).toThrow();
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    place(board, { x: 0, y: 0 }, veil);
    expect(pictureOf(board)).toBe(before);
  });
});
