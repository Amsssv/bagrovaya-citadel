import { describe, expect, it } from 'vitest';

import { cellAt } from '@/entities/board';
// Помощник тестов лежит внутри слайса поля и наружу не экспортируется.
import { boardFrom, pictureOf } from '@/entities/board/__testing__/boardFrom';

import { createCitadel } from './hearts';
import { wallInCandidates, wallInStones } from './wall';

describe('кандидаты на замуровывание (§9)', () => {
  it('камень в верхнем ряду — у самой цитадели', () => {
    const board = boardFrom(`
      s t s
      t s a
      a f b
    `);
    expect(wallInCandidates(board)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('другие ресурсы в верхнем ряду не считаются', () => {
    const board = boardFrom(`
      t a f
      s s s
    `);
    expect(wallInCandidates(board)).toEqual([]);
  });

  it('камень ниже верхнего ряда не считается: до стены он не достаёт', () => {
    const board = boardFrom(`
      t a f
      s s s
      s s s
    `);
    expect(wallInCandidates(board)).toEqual([]);
  });

  it('постройка, потир и пустая клетка не замуровываются', () => {
    const board = boardFrom(`
      G P .
      s t a
    `);
    expect(wallInCandidates(board)).toEqual([]);
  });
});

describe('замуровывание', () => {
  const board = boardFrom(`
    s t s
    t a f
    a f b
  `);

  it('камень уходит со стены, цитадель получает сердце', () => {
    const citadel = createCitadel(10, 30);
    const result = wallInStones(board, citadel, [{ x: 0, y: 0 }], 1);

    expect(cellAt(result.board, { x: 0, y: 0 }).kind).toBe('empty');
    expect(result.citadel.hearts).toBe(11);
    expect(result.walled).toEqual([{ x: 0, y: 0 }]);
  });

  it('несколько камней за раз', () => {
    const result = wallInStones(
      board,
      createCitadel(10, 30),
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      1,
    );
    expect(result.citadel.hearts).toBe(12);
    expect(result.walled).toHaveLength(2);
  });

  it('за камень можно давать больше одного сердца — это настройка', () => {
    const result = wallInStones(board, createCitadel(10, 30), [{ x: 0, y: 0 }], 3);
    expect(result.citadel.hearts).toBe(13);
  });

  it('пустой список ничего не меняет', () => {
    const citadel = createCitadel(10, 30);
    const result = wallInStones(board, citadel, [], 1);
    expect(pictureOf(result.board)).toBe(pictureOf(board));
    expect(result.citadel).toEqual(citadel);
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    wallInStones(board, createCitadel(10, 30), [{ x: 0, y: 0 }], 1);
    expect(pictureOf(board)).toBe(before);
  });
});

describe('замуровывание на полном запасе', () => {
  const board = boardFrom(`
    s t s
    t a f
    a f b
  `);

  it('на потолке камень остаётся на месте: тратить его впустую незачем', () => {
    const citadel = createCitadel(30, 30);
    const result = wallInStones(board, citadel, [{ x: 0, y: 0 }], 1);

    expect(result.walled).toEqual([]);
    expect(pictureOf(result.board)).toBe(pictureOf(board));
    expect(result.citadel.hearts).toBe(30);
  });

  it('до потолка замуровывается ровно столько, сколько влезает', () => {
    const result = wallInStones(
      board,
      createCitadel(29, 30),
      [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      1,
    );
    expect(result.citadel.hearts).toBe(30);
    expect(result.walled).toEqual([{ x: 0, y: 0 }]);
    expect(cellAt(result.board, { x: 2, y: 0 }).kind).toBe('tile');
  });
});

describe('замуровать можно только кандидата', () => {
  const board = boardFrom(`
    s t s
    t a f
  `);

  it('не камень — ошибка', () => {
    expect(() => wallInStones(board, createCitadel(10, 30), [{ x: 1, y: 0 }], 1)).toThrow();
  });

  it('не верхний ряд — ошибка', () => {
    expect(() => wallInStones(board, createCitadel(10, 30), [{ x: 0, y: 1 }], 1)).toThrow();
  });

  it('за краем поля — ошибка', () => {
    expect(() => wallInStones(board, createCitadel(10, 30), [{ x: 9, y: 0 }], 1)).toThrow();
  });
});
