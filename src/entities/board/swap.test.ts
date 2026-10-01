import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { cellAt, withCells } from './board';
import { canDropOffEdge, canSwap, dropOffEdge, swap } from './swap';
import { building, potion, tile } from './types';

describe('свап', () => {
  const board = boardFrom(`
    s t a
    f b G
    M V W
  `);

  it('меняет местами две соседние клетки по горизонтали', () => {
    const next = swap(board, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(cellAt(next, { x: 0, y: 0 })).toEqual(tile('thorn'));
    expect(cellAt(next, { x: 1, y: 0 })).toEqual(tile('stone'));
  });

  it('меняет местами две соседние клетки по вертикали', () => {
    const next = swap(board, { x: 0, y: 0 }, { x: 0, y: 1 });
    expect(cellAt(next, { x: 0, y: 0 })).toEqual(tile('fog'));
    expect(cellAt(next, { x: 0, y: 1 })).toEqual(tile('stone'));
  });

  it('двигает готовую постройку — на этом держится вся тактика', () => {
    const next = swap(board, { x: 2, y: 1 }, { x: 2, y: 0 });
    expect(cellAt(next, { x: 2, y: 0 })).toEqual(building('gargoyle', 'raw'));
    expect(cellAt(next, { x: 2, y: 1 })).toEqual(tile('ash'));
  });

  it('меняет местами две постройки', () => {
    const next = swap(board, { x: 0, y: 2 }, { x: 1, y: 2 });
    expect(cellAt(next, { x: 0, y: 2 })).toEqual(building('vine', 'raw'));
    expect(cellAt(next, { x: 1, y: 2 })).toEqual(building('mortar', 'raw'));
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    swap(board, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(pictureOf(board)).toBe(before);
  });
});

describe('canSwap', () => {
  const board = boardFrom(`
    s t a
    f b s
    t a f
  `);

  it('разрешает четыре стороны', () => {
    expect(canSwap(board, { x: 1, y: 1 }, { x: 1, y: 0 })).toBe(true);
    expect(canSwap(board, { x: 1, y: 1 }, { x: 1, y: 2 })).toBe(true);
    expect(canSwap(board, { x: 1, y: 1 }, { x: 0, y: 1 })).toBe(true);
    expect(canSwap(board, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
  });

  it('запрещает диагональ', () => {
    expect(canSwap(board, { x: 1, y: 1 }, { x: 0, y: 0 })).toBe(false);
    expect(canSwap(board, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });

  it('запрещает клетку саму с собой', () => {
    expect(canSwap(board, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('запрещает прыжок через клетку', () => {
    expect(canSwap(board, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it('запрещает выход за край', () => {
    expect(canSwap(board, { x: 0, y: 0 }, { x: -1, y: 0 })).toBe(false);
    expect(canSwap(board, { x: 2, y: 2 }, { x: 3, y: 2 })).toBe(false);
  });

  it('swap бросает, если ход запрещён', () => {
    expect(() => swap(board, { x: 1, y: 1 }, { x: 0, y: 0 })).toThrow();
  });
});

describe('сброс за край', () => {
  const board = boardFrom(`
    s t a
    f b G
    M V P
  `);

  it('сбрасывает сырой ресурс влево из первого столбца', () => {
    expect(canDropOffEdge(board, { x: 0, y: 0 }, 'left')).toBe(true);
    const next = dropOffEdge(board, { x: 0, y: 0 }, 'left');
    expect(cellAt(next, { x: 0, y: 0 }).kind).toBe('empty');
  });

  it('сбрасывает вправо из последнего столбца', () => {
    expect(canDropOffEdge(board, { x: 2, y: 0 }, 'right')).toBe(true);
  });

  it('сбрасывает вниз из последнего ряда', () => {
    const lowTile = boardFrom(`
      s t a
      f b G
      M V s
    `);
    expect(canDropOffEdge(lowTile, { x: 2, y: 2 }, 'down')).toBe(true);
  });

  it('вверх сбросить нельзя — там цитадель', () => {
    expect(canDropOffEdge(board, { x: 0, y: 0 }, 'up')).toBe(false);
  });

  it('постройку сбросить можно — как в оригинале, освободить место', () => {
    expect(canDropOffEdge(board, { x: 0, y: 2 }, 'left')).toBe(true);
    expect(cellAt(dropOffEdge(board, { x: 0, y: 2 }, 'left'), { x: 0, y: 2 }).kind).toBe('empty');
  });

  it('потир сбросить нельзя', () => {
    expect(canDropOffEdge(board, { x: 2, y: 2 }, 'right')).toBe(false);
  });

  it('пустую клетку сбросить нельзя', () => {
    const withHole = boardFrom(`
      . t a
      f b G
      M V P
    `);
    expect(canDropOffEdge(withHole, { x: 0, y: 0 }, 'left')).toBe(false);
  });

  it('направление внутрь поля — не сброс', () => {
    expect(canDropOffEdge(board, { x: 0, y: 0 }, 'right')).toBe(false);
    expect(canDropOffEdge(board, { x: 1, y: 0 }, 'left')).toBe(false);
  });

  it('dropOffEdge бросает, если сброс запрещён', () => {
    expect(() => dropOffEdge(board, { x: 0, y: 0 }, 'up')).toThrow();
    expect(() => dropOffEdge(board, { x: 2, y: 2 }, 'right')).toThrow();
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    dropOffEdge(board, { x: 0, y: 0 }, 'left');
    expect(pictureOf(board)).toBe(before);
  });

  it('сбрасывается любой из пяти ресурсов', () => {
    const all = boardFrom(`
      s t a
      f b s
      t a f
    `);
    for (let y = 0; y < 3; y++) {
      expect(canDropOffEdge(all, { x: 0, y }, 'left')).toBe(true);
    }
  });

  it('постройка сбрасывается на любой ступени, потир — ни на какой', () => {
    const upgraded = withCells(boardFrom('s s'), [
      [{ x: 0, y: 0 }, building('gargoyle', 'crimson')],
      [{ x: 1, y: 0 }, potion('obsidian')],
    ]);
    expect(canDropOffEdge(upgraded, { x: 0, y: 0 }, 'left')).toBe(true);
    expect(canDropOffEdge(upgraded, { x: 1, y: 0 }, 'right')).toBe(false);
  });

  it('за краем поля сброса нет', () => {
    expect(canDropOffEdge(board, { x: 9, y: 9 }, 'left')).toBe(false);
  });
});
