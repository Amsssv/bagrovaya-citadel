import { describe, expect, it } from 'vitest';

import { createRng } from '@/shared/lib/rng';

import { pictureOf } from './__testing__/boardFrom';
import { createBoard } from './generate';
import { findMatches } from './match';
import type { ResourceId } from './types';

const ALL: readonly ResourceId[] = ['stone', 'thorn', 'ash', 'fog', 'blood'];

describe('createBoard', () => {
  it('делает поле заданного размера, целиком из сырых плиток', () => {
    const board = createBoard(createRng(1).fork('board'), {
      width: 6,
      height: 6,
      resources: ALL,
      withoutMatches: true,
    });
    expect(board.width).toBe(6);
    expect(board.height).toBe(6);
    expect(board.cells).toHaveLength(36);
    expect(board.cells.every((cell) => cell.kind === 'tile')).toBe(true);
  });

  it('на одном сиде даёт одну и ту же раздачу', () => {
    const make = (): string =>
      pictureOf(
        createBoard(createRng(42).fork('board'), {
          width: 6,
          height: 6,
          resources: ALL,
          withoutMatches: true,
        }),
      );
    expect(make()).toBe(make());
  });

  it('на разных сидах раздача разная', () => {
    const make = (seed: number): string =>
      pictureOf(
        createBoard(createRng(seed).fork('board'), {
          width: 6,
          height: 6,
          resources: ALL,
          withoutMatches: true,
        }),
      );
    expect(make(1)).not.toBe(make(2));
  });

  it('готовых троек на старте нет — ни на одном из ста сидов', () => {
    for (let seed = 0; seed < 100; seed++) {
      const board = createBoard(createRng(seed).fork('board'), {
        width: 6,
        height: 6,
        resources: ALL,
        withoutMatches: true,
      });
      expect(findMatches(board), `сид ${String(seed)} выдал готовую тройку`).toEqual([]);
    }
  });

  it('с выключенной пересдачей тройки допускаются', () => {
    const board = createBoard(createRng(1).fork('board'), {
      width: 6,
      height: 6,
      resources: ['stone'],
      withoutMatches: false,
    });
    expect(findMatches(board).length).toBeGreaterThan(0);
  });

  it('из одного ресурса поле без троек не собрать — это ошибка, а не тихий результат', () => {
    expect(() =>
      createBoard(createRng(1).fork('board'), {
        width: 6,
        height: 6,
        resources: ['stone'],
        withoutMatches: true,
      }),
    ).toThrow();
  });

  it('поле не обязано быть квадратным', () => {
    const board = createBoard(createRng(1).fork('board'), {
      width: 5,
      height: 9,
      resources: ALL,
      withoutMatches: true,
    });
    expect(board.cells).toHaveLength(45);
    expect(findMatches(board)).toEqual([]);
  });
});
