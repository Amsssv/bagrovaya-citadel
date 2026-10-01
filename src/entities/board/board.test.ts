import { describe, expect, it } from 'vitest';

import { boardFrom } from './__testing__/boardFrom';
import { cellAt, createEmptyBoard, inBounds, indexAt, positionAt, withCells } from './board';
import { EMPTY, tile } from './types';

describe('createEmptyBoard', () => {
  it('делает поле заданного размера из пустых клеток', () => {
    const board = createEmptyBoard(6, 6);
    expect(board.width).toBe(6);
    expect(board.height).toBe(6);
    expect(board.cells).toHaveLength(36);
    expect(board.cells.every((cell) => cell.kind === 'empty')).toBe(true);
  });

  it('поле не обязано быть квадратным — другие цитадели меняют размер', () => {
    const board = createEmptyBoard(5, 9);
    expect(board.cells).toHaveLength(45);
  });
});

describe('координаты', () => {
  const board = createEmptyBoard(6, 6);

  it('индекс считается построчно: y = 0 — ряд у цитадели', () => {
    expect(indexAt(board, { x: 0, y: 0 })).toBe(0);
    expect(indexAt(board, { x: 5, y: 0 })).toBe(5);
    expect(indexAt(board, { x: 0, y: 1 })).toBe(6);
    expect(indexAt(board, { x: 5, y: 5 })).toBe(35);
  });

  it('positionAt — обратная операция к indexAt', () => {
    for (let index = 0; index < board.cells.length; index++) {
      expect(indexAt(board, positionAt(board, index))).toBe(index);
    }
  });

  it('inBounds различает край и то, что за краем', () => {
    expect(inBounds(board, { x: 0, y: 0 })).toBe(true);
    expect(inBounds(board, { x: 5, y: 5 })).toBe(true);
    expect(inBounds(board, { x: -1, y: 0 })).toBe(false);
    expect(inBounds(board, { x: 0, y: -1 })).toBe(false);
    expect(inBounds(board, { x: 6, y: 0 })).toBe(false);
    expect(inBounds(board, { x: 0, y: 6 })).toBe(false);
  });
});

describe('cellAt', () => {
  const board = boardFrom(`
    s t a
    f b .
  `);

  it('достаёт клетку по координате', () => {
    expect(cellAt(board, { x: 0, y: 0 })).toEqual(tile('stone'));
    expect(cellAt(board, { x: 2, y: 0 })).toEqual(tile('ash'));
    expect(cellAt(board, { x: 1, y: 1 })).toEqual(tile('blood'));
    expect(cellAt(board, { x: 2, y: 1 })).toEqual(EMPTY);
  });

  it('за краем — ошибка, а не тихий undefined', () => {
    expect(() => cellAt(board, { x: 3, y: 0 })).toThrow();
    expect(() => cellAt(board, { x: 0, y: -1 })).toThrow();
  });
});

describe('withCells', () => {
  it('возвращает новое поле с заменёнными клетками', () => {
    const board = boardFrom(`
      s s
      s s
    `);
    const next = withCells(board, [
      [{ x: 0, y: 0 }, tile('fog')],
      [{ x: 1, y: 1 }, EMPTY],
    ]);

    expect(cellAt(next, { x: 0, y: 0 })).toEqual(tile('fog'));
    expect(cellAt(next, { x: 1, y: 1 })).toEqual(EMPTY);
    expect(cellAt(next, { x: 1, y: 0 })).toEqual(tile('stone'));
  });

  it('не трогает исходное поле', () => {
    const board = boardFrom(`
      s s
      s s
    `);
    withCells(board, [[{ x: 0, y: 0 }, EMPTY]]);
    expect(cellAt(board, { x: 0, y: 0 })).toEqual(tile('stone'));
  });

  it('за краем — ошибка: молчаливая запись мимо массива порвала бы поле', () => {
    const board = boardFrom('s s');
    expect(() => withCells(board, [[{ x: 5, y: 0 }, EMPTY]])).toThrow();
  });
});

describe('boardFrom — помощник тестов', () => {
  it('читает картинку построчно сверху вниз', () => {
    const board = boardFrom(`
      s t
      a f
    `);
    expect(board.width).toBe(2);
    expect(board.height).toBe(2);
    expect(cellAt(board, { x: 1, y: 0 })).toEqual(tile('thorn'));
    expect(cellAt(board, { x: 0, y: 1 })).toEqual(tile('ash'));
  });

  it('ругается на строки разной длины', () => {
    expect(() => boardFrom('s t\ns')).toThrow();
  });

  it('ругается на неизвестный символ', () => {
    expect(() => boardFrom('s x')).toThrow();
  });

  it('ругается на пустую картинку', () => {
    expect(() => boardFrom('   ')).toThrow();
  });
});
