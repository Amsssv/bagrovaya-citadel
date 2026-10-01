import { describe, expect, it } from 'vitest';

import type { Board } from '@/entities/board';
import { building, potion, tile } from '@/entities/board';

import { nextTip } from './tips';

describe('подсказки к первой встрече', () => {
  const plain: Board = { width: 3, height: 2, cells: Array.from({ length: 6 }, () => tile('ash')) };
  const put = (index: number, cell: Board['cells'][number]): Board => ({
    ...plain,
    cells: plain.cells.map((old, i) => (i === index ? cell : old)),
  });

  it('новая постройка — подсказка к ней, уже видели — нет', () => {
    const board = put(4, building('vine', 'raw'));
    expect(nextTip(board, [])).toBe('vine');
    expect(nextTip(board, ['vine'])).toBeNull();
    expect(nextTip(plain, [])).toBeNull();
  });

  it('горгулья в верхнем углу — про башню замка', () => {
    expect(nextTip(put(0, building('gargoyle', 'raw')), ['gargoyle'])).toBe('turret');
    expect(nextTip(put(2, building('gargoyle', 'raw')), ['gargoyle'])).toBe('turret');
    // Не в углу — только сама горгулья.
    expect(nextTip(put(1, building('gargoyle', 'raw')), ['gargoyle'])).toBeNull();
    expect(nextTip(put(3, building('gargoyle', 'raw')), ['gargoyle'])).toBeNull();
    // Лоза в углу про башню не говорит.
    expect(nextTip(put(0, building('vine', 'raw')), ['vine'])).toBeNull();
  });

  it('потир — своя подсказка, одна', () => {
    const board = put(4, potion('raw'));
    expect(nextTip(board, [])).toBe('potion');
    // Про босса здесь не напоминают: о нём — каждую его ночь, в App.
    expect(nextTip(board, ['potion'])).toBeNull();
  });
});
