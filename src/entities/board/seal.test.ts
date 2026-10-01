import { describe, expect, it } from 'vitest';

import { BUILDINGS } from '@/entities/building';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { cellAt, withCells } from './board';
import { applySealAt, canSealAt } from './seal';
import { building, potion } from './types';

describe('печать поднимает одну постройку', () => {
  const board = boardFrom(`
    G s t
    s t a
  `);

  it('костяная печать делает грубую горгулью костяной', () => {
    expect(canSealAt(board, { x: 0, y: 0 }, 'bone')).toBe(true);
    const next = applySealAt(board, { x: 0, y: 0 }, 'bone');
    expect(cellAt(next, { x: 0, y: 0 })).toEqual(building('gargoyle', 'bone'));
  });

  it('работает на всех четырёх постройках', () => {
    for (const kind of BUILDINGS) {
      const one = withCells(board, [[{ x: 0, y: 0 }, building(kind, 'raw')]]);
      expect(canSealAt(one, { x: 0, y: 0 }, 'bone'), kind).toBe(true);
      expect(cellAt(applySealAt(one, { x: 0, y: 0 }, 'bone'), { x: 0, y: 0 })).toEqual(
        building(kind, 'bone'),
      );
    }
  });

  it('поднимает по всей лестнице', () => {
    const bone = withCells(board, [[{ x: 0, y: 0 }, building('gargoyle', 'bone')]]);
    expect(cellAt(applySealAt(bone, { x: 0, y: 0 }, 'obsidian'), { x: 0, y: 0 })).toEqual(
      building('gargoyle', 'obsidian'),
    );

    const obsidian = withCells(board, [[{ x: 0, y: 0 }, building('gargoyle', 'obsidian')]]);
    expect(cellAt(applySealAt(obsidian, { x: 0, y: 0 }, 'crimson'), { x: 0, y: 0 })).toEqual(
      building('gargoyle', 'crimson'),
    );
  });

  it('развёрнутая мортира остаётся развёрнутой', () => {
    const flipped = { ...building('mortar', 'raw'), facing: 'left' as const };
    const one = withCells(board, [[{ x: 0, y: 0 }, flipped]]);
    expect(cellAt(applySealAt(one, { x: 0, y: 0 }, 'bone'), { x: 0, y: 0 })).toEqual({
      ...building('mortar', 'bone'),
      facing: 'left',
    });
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    applySealAt(board, { x: 0, y: 0 }, 'bone');
    expect(pictureOf(board)).toBe(before);
  });
});

describe('куда печать не ложится', () => {
  const board = boardFrom(`
    G s t
    P t a
  `);

  it('на потир — не действует: потир не постройка (§6)', () => {
    expect(canSealAt(board, { x: 0, y: 1 }, 'bone')).toBe(false);
  });

  it('на сырую плитку', () => {
    expect(canSealAt(board, { x: 1, y: 0 }, 'bone')).toBe(false);
  });

  it('на пустую клетку', () => {
    const withHole = boardFrom(`
      . s t
      s t a
    `);
    expect(canSealAt(withHole, { x: 0, y: 0 }, 'bone')).toBe(false);
  });

  it('за краем поля', () => {
    expect(canSealAt(board, { x: 9, y: 9 }, 'bone')).toBe(false);
  });

  it('на ступень, к которой печать не подходит', () => {
    const bone = withCells(board, [[{ x: 0, y: 0 }, building('gargoyle', 'bone')]]);
    expect(canSealAt(bone, { x: 0, y: 0 }, 'bone')).toBe(false);
    expect(canSealAt(bone, { x: 0, y: 0 }, 'crimson')).toBe(false);
  });

  it('на багровую — потолок, поднимать нечем', () => {
    const crimson = withCells(board, [[{ x: 0, y: 0 }, building('gargoyle', 'crimson')]]);
    expect(canSealAt(crimson, { x: 0, y: 0 }, 'crimson')).toBe(false);
  });

  it('applySealAt бросает, если печать не ложится', () => {
    expect(() => applySealAt(board, { x: 0, y: 1 }, 'bone')).toThrow();
    expect(() => applySealAt(board, { x: 1, y: 0 }, 'bone')).toThrow();
  });

  it('багровый потир печатью не поднять — ни одной', () => {
    const crimsonPotion = withCells(board, [[{ x: 0, y: 1 }, potion('crimson')]]);
    expect(canSealAt(crimsonPotion, { x: 0, y: 1 }, 'crimson')).toBe(false);
  });
});
