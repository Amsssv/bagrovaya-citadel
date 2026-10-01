import { describe, expect, it } from 'vitest';

import { building, tile } from '@/entities/board';
import { boardFrom } from '@/entities/board/__testing__/boardFrom';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import type { Position } from '@/shared/lib/geometry';

import { attackZone } from './reach';

const BOARD = boardFrom(`
  s s s s s s
  s s s s s s
  s s s s s s
  s s s s s s
  s s s s s s
  s s s s s s
`);

const key = (cells: readonly Position[]): string[] =>
  cells.map(({ x, y }) => `${String(x)},${String(y)}`).sort();

describe('зона атаки постройки', () => {
  it('горгулья — своя клетка и соседние, у края — только то, что на поле', () => {
    const zone = attackZone(BOARD, { x: 0, y: 0 }, building('gargoyle', 'raw'), BUILDING_BOOK);
    expect(key(zone)).toEqual(['0,0', '0,1', '1,0', '1,1']);
  });

  it('горгулья нижнего ряда достаёт и под поле', () => {
    const zone = attackZone(BOARD, { x: 2, y: 5 }, building('gargoyle', 'bone'), BUILDING_BOOK, {
      shootDepth: 3,
    });
    expect(zone.some((cell) => cell.y === 6)).toBe(true);
    expect(zone).toHaveLength(9);
  });

  it('лоза — весь свой столбец, с простреливаемыми рядами под полем', () => {
    const zone = attackZone(BOARD, { x: 4, y: 2 }, building('vine', 'raw'), BUILDING_BOOK, {
      shootDepth: 3,
    });
    expect(zone.every((cell) => cell.x === 4)).toBe(true);
    expect(zone).toHaveLength(9);
  });

  it('мортира — весь свой ряд', () => {
    const zone = attackZone(BOARD, { x: 1, y: 3 }, building('mortar', 'obsidian'), BUILDING_BOOK);
    expect(key(zone)).toEqual(['0,3', '1,3', '2,3', '3,3', '4,3', '5,3']);
  });

  it('завеса не стреляет — её зона своя клетка, где она тормозит', () => {
    const at = { x: 3, y: 3 };
    expect(attackZone(BOARD, at, building('fogveil', 'raw'), BUILDING_BOOK)).toEqual([at]);
  });

  it('башня замка — над полем, со своим радиусом', () => {
    const zone = attackZone(BOARD, { x: 0, y: -1 }, building('gargoyle', 'raw'), BUILDING_BOOK, {
      range: 2,
    });
    expect(key(zone)).toEqual(['0,0', '0,1', '1,0', '1,1', '2,0', '2,1']);
  });

  it('у плитки зоны нет', () => {
    expect(attackZone(BOARD, { x: 0, y: 0 }, tile('stone'), BUILDING_BOOK)).toEqual([]);
  });
});
