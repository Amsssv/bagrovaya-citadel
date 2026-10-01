import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { cellAt, withCells } from './board';
import { applyMerges, findMerges } from './merge';
import { building, potion } from './types';

describe('слияние трёх одинаковых (§6)', () => {
  it('три горгульи в ряд дают одну костяную', () => {
    const merges = findMerges(
      boardFrom(`
        G G G
        s t a
        t a s
      `),
    );
    expect(merges).toHaveLength(1);
    expect(merges[0]?.into).toEqual(building('gargoyle', 'bone'));
    expect(merges[0]?.cells).toHaveLength(3);
  });

  it('три в столбец тоже сливаются', () => {
    const merges = findMerges(
      boardFrom(`
        G s t
        G t a
        G a s
      `),
    );
    expect(merges).toHaveLength(1);
  });

  it('три углом (буквой Г) не сливаются — только в линию', () => {
    const merges = findMerges(
      boardFrom(`
        G G t
        G t a
        t a s
      `),
    );
    expect(merges).toEqual([]);
  });

  it('угол из потиров тоже не сливается', () => {
    const merges = findMerges(
      boardFrom(`
        P t s
        P P a
        t a s
      `),
    );
    expect(merges).toEqual([]);
  });

  it('Г из пяти — одно слияние: пересекающиеся линии объединяются, как в оригинале', () => {
    const board = boardFrom(`
      G G G
      G t a
      G a s
    `);
    const merges = findMerges(board);
    expect(merges).toHaveLength(1);
    expect(merges[0]?.cells).toHaveLength(5);
  });

  it('результат Г встаёт туда, куда двигал игрок', () => {
    const board = boardFrom(`
      G G G
      G t a
      G a s
    `);
    expect(findMerges(board, [{ x: 0, y: 2 }])[0]?.position).toEqual({ x: 0, y: 2 });
  });

  it('по диагонали — не рядом', () => {
    const merges = findMerges(
      boardFrom(`
        G s t
        s G a
        t a G
      `),
    );
    expect(merges).toEqual([]);
  });

  it('двух мало', () => {
    const merges = findMerges(
      boardFrom(`
        G G t
        s t a
        t a s
      `),
    );
    expect(merges).toEqual([]);
  });

  it('разные постройки не сливаются', () => {
    const merges = findMerges(
      boardFrom(`
        G V M
        s t a
        t a s
      `),
    );
    expect(merges).toEqual([]);
  });

  it('разные ступени не сливаются', () => {
    const board = withCells(
      boardFrom(`
        G G G
        s t a
        t a s
      `),
      [[{ x: 1, y: 0 }, building('gargoyle', 'bone')]],
    );
    expect(findMerges(board)).toEqual([]);
  });

  it('две разные тройки дают два слияния', () => {
    const merges = findMerges(
      boardFrom(`
        G G G
        V V V
        t a s
      `),
    );
    expect(merges).toHaveLength(2);
    expect(
      merges
        .map((merge) => merge.into)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    ).toEqual([building('gargoyle', 'bone'), building('vine', 'bone')]);
  });
});

describe('слияние по всей лестнице', () => {
  it('костяные дают обсидиановую', () => {
    const board = withCells(boardFrom('G G G'), [
      [{ x: 0, y: 0 }, building('gargoyle', 'bone')],
      [{ x: 1, y: 0 }, building('gargoyle', 'bone')],
      [{ x: 2, y: 0 }, building('gargoyle', 'bone')],
    ]);
    expect(findMerges(board)[0]?.into).toEqual(building('gargoyle', 'obsidian'));
  });

  it('обсидиановые дают багровую', () => {
    const board = withCells(boardFrom('G G G'), [
      [{ x: 0, y: 0 }, building('gargoyle', 'obsidian')],
      [{ x: 1, y: 0 }, building('gargoyle', 'obsidian')],
      [{ x: 2, y: 0 }, building('gargoyle', 'obsidian')],
    ]);
    expect(findMerges(board)[0]?.into).toEqual(building('gargoyle', 'crimson'));
  });

  it('багровые не сливаются — это потолок', () => {
    const board = withCells(boardFrom('G G G'), [
      [{ x: 0, y: 0 }, building('gargoyle', 'crimson')],
      [{ x: 1, y: 0 }, building('gargoyle', 'crimson')],
      [{ x: 2, y: 0 }, building('gargoyle', 'crimson')],
    ]);
    expect(findMerges(board)).toEqual([]);
  });
});

describe('потиры сливаются по той же лестнице (§8)', () => {
  it('три грубых потира дают костяной', () => {
    const merges = findMerges(
      boardFrom(`
        P P P
        s t a
        t a s
      `),
    );
    expect(merges).toHaveLength(1);
    expect(merges[0]?.into).toEqual(potion('bone'));
  });

  it('потир не сливается с постройкой', () => {
    const merges = findMerges(
      boardFrom(`
        P P G
        s t a
        t a s
      `),
    );
    expect(merges).toEqual([]);
  });

  it('багровые потиры тоже потолок', () => {
    const board = withCells(boardFrom('P P P'), [
      [{ x: 0, y: 0 }, potion('crimson')],
      [{ x: 1, y: 0 }, potion('crimson')],
      [{ x: 2, y: 0 }, potion('crimson')],
    ]);
    expect(findMerges(board)).toEqual([]);
  });
});

describe('где встаёт слитая постройка', () => {
  it('на клетке, куда двигали, если она входит в тройку', () => {
    const board = boardFrom(`
      G G G
      s t a
      t a s
    `);
    const merges = findMerges(board, [{ x: 2, y: 0 }]);
    expect(merges[0]?.position).toEqual({ x: 2, y: 0 });
  });

  it('первое подходящее из списка предпочтений выигрывает', () => {
    const board = boardFrom(`
      G G G
      s t a
      t a s
    `);
    const merges = findMerges(board, [
      { x: 9, y: 9 },
      { x: 0, y: 0 },
    ]);
    expect(merges[0]?.position).toEqual({ x: 0, y: 0 });
  });

  it('без предпочтений берётся середина группы — заглушка, спека молчит', () => {
    const board = boardFrom(`
      G G G
      s t a
      t a s
    `);
    expect(findMerges(board)[0]?.position).toEqual({ x: 1, y: 0 });
  });
});

describe('больше трёх в линию — как в оригинале', () => {
  it('сливается вся линия в одну постройку ступенью выше', () => {
    const merges = findMerges(
      boardFrom(`
        G G G G
        s t a s
        t a s t
      `),
    );
    expect(merges).toHaveLength(1);
    expect(merges[0]?.cells).toHaveLength(4);
    expect(merges[0]?.into).toEqual(building('gargoyle', 'bone'));
  });

  it('результат встаёт на клетку назначения', () => {
    const merges = findMerges(
      boardFrom(`
        G G G G
        s t a s
        t a s t
      `),
      [{ x: 3, y: 0 }],
    );
    expect(merges[0]?.position).toEqual({ x: 3, y: 0 });
  });

  it('две линии, не касающиеся друг друга, — два слияния', () => {
    const merges = findMerges(
      boardFrom(`
        G G G s
        s t a s
        V V V t
      `),
    );
    expect(merges).toHaveLength(2);
  });
});

describe('applyMerges', () => {
  const board = boardFrom(`
    G G G
    s t a
    t a s
  `);

  it('убирает три клетки и ставит одну новую', () => {
    const next = applyMerges(board, findMerges(board, [{ x: 0, y: 0 }]));
    expect(cellAt(next, { x: 0, y: 0 })).toEqual(building('gargoyle', 'bone'));
    expect(cellAt(next, { x: 1, y: 0 }).kind).toBe('empty');
    expect(cellAt(next, { x: 2, y: 0 }).kind).toBe('empty');
  });

  it('две освободившиеся клетки — та самая цена слияния из §6', () => {
    const next = applyMerges(board, findMerges(board));
    const empties = next.cells.filter((cell) => cell.kind === 'empty');
    expect(empties).toHaveLength(2);
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    applyMerges(board, findMerges(board));
    expect(pictureOf(board)).toBe(before);
  });

  it('пустой список слияний ничего не меняет', () => {
    expect(pictureOf(applyMerges(board, []))).toBe(pictureOf(board));
  });
});
