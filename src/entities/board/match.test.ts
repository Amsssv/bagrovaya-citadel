import { describe, expect, it } from 'vitest';

import { boardFrom } from './__testing__/boardFrom';
import { findMatches, matchedIndices } from './match';
import type { Match } from './match';

/** Матчи в виде «ресурс: сколько клеток», отсортированные — так тест читается. */
function shapeOf(matches: readonly Match[]): string[] {
  return matches
    .map((match) => `${match.resource}:${String(match.cells.length)}`)
    .sort((a, b) => a.localeCompare(b));
}

describe('findMatches', () => {
  it('находит тройку по горизонтали', () => {
    const matches = findMatches(
      boardFrom(`
        s s s t a f
        t a f t a f
        a f t a f t
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:3']);
    expect(matches[0]?.cells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('находит тройку по вертикали', () => {
    const matches = findMatches(
      boardFrom(`
        s t a f t a
        s a f t a f
        s f t a f t
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:3']);
    expect(matches[0]?.cells).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ]);
  });

  it('четвёрка — это один матч из четырёх клеток, а не две тройки', () => {
    const matches = findMatches(
      boardFrom(`
        s s s s a f
        t a f t a f
        a f t a f t
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:4']);
  });

  it('пятёрка во всю строку тоже один матч', () => {
    const matches = findMatches(
      boardFrom(`
        s s s s s f
        t a f t a f
        a f t a f t
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:5']);
  });

  it('две отдельные тройки — два матча', () => {
    const matches = findMatches(
      boardFrom(`
        s s s t t t
        a f a f a f
        f a f a f a
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:3', 'thorn:3']);
  });

  it('пара не считается', () => {
    const matches = findMatches(
      boardFrom(`
        s s t a f t
        a f a f a f
        f a f a f a
      `),
    );
    expect(matches).toEqual([]);
  });

  it('разные ресурсы подряд не складываются', () => {
    const matches = findMatches(
      boardFrom(`
        s t s t s t
        t s t s t s
        s t s t s t
      `),
    );
    expect(matches).toEqual([]);
  });
});

describe('findMatches — фигуры Г и Т', () => {
  it('три плитки углом (буквой Г) — не матч', () => {
    expect(
      findMatches(
        boardFrom(`
          s s t
          s t a
          t a f
        `),
      ),
    ).toEqual([]);
  });

  it('угол считается одним матчем, а не двумя пересекающимися', () => {
    // Горизонталь и вертикаль делят угловую клетку: пять плиток, один матч.
    const matches = findMatches(
      boardFrom(`
        s s s t a f
        s a f t a f
        s f t a f t
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:5']);
  });

  it('буква Т тоже один матч', () => {
    const matches = findMatches(
      boardFrom(`
        s s s t a f
        t s f t a f
        a s t a f t
      `),
    );
    expect(shapeOf(matches)).toEqual(['stone:5']);
  });

  it('клетки матча не повторяются', () => {
    const matches = findMatches(
      boardFrom(`
        s s s t a f
        s a f t a f
        s f t a f t
      `),
    );
    const cells = matches[0]?.cells ?? [];
    expect(new Set(cells.map((cell) => `${String(cell.x)},${String(cell.y)}`)).size).toBe(
      cells.length,
    );
  });
});

describe('findMatches — что не матчится', () => {
  it('постройки не складываются в тройку: они сливаются, а это другое правило', () => {
    const matches = findMatches(
      boardFrom(`
        G G G t a f
        t a f t a f
        a f t a f t
      `),
    );
    expect(matches).toEqual([]);
  });

  it('потиры тоже не матчатся', () => {
    const matches = findMatches(
      boardFrom(`
        P P P t a f
        t a f t a f
        a f t a f t
      `),
    );
    expect(matches).toEqual([]);
  });

  it('пустые клетки не матчатся', () => {
    const matches = findMatches(
      boardFrom(`
        . . . t a f
        t a f t a f
        a f t a f t
      `),
    );
    expect(matches).toEqual([]);
  });

  it('тройка не перескакивает через постройку', () => {
    const matches = findMatches(
      boardFrom(`
        s s G s s f
        t a f t a f
        a f t a f t
      `),
    );
    expect(matches).toEqual([]);
  });

  it('тройка не переходит с конца строки на начало следующей', () => {
    const matches = findMatches(
      boardFrom(`
        t a f t s s
        s a f t a f
        a f t a f t
      `),
    );
    expect(matches).toEqual([]);
  });
});

describe('matchedIndices', () => {
  it('собирает все клетки всех матчей в один набор', () => {
    const board = boardFrom(`
      s s s t t t
      a f a f a f
      f a f a f a
    `);
    expect(matchedIndices(board, findMatches(board))).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('на пустом списке даёт пустой набор', () => {
    const board = boardFrom('s t a');
    expect(matchedIndices(board, [])).toEqual(new Set());
  });
});
