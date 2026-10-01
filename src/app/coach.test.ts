import { describe, expect, it, vi } from 'vitest';

import type { Beat } from '@/features/tutorial';
import type { SceneLayout } from '@/widgets/board';

import { coachFor } from './coach';

// Баррель виджета тянет Phaser, а ему нужен браузер; геометрия поля — без него.
vi.mock('@/widgets/board', () => import('@/widgets/board/layout'));

const layout = {
  originX: 100,
  originY: 200,
  cellSize: 40,
} as SceneLayout;

const P = (x: number, y: number) => ({ x, y });

describe('coachFor', () => {
  it('нет шага — нет подсказки', () => {
    expect(coachFor(undefined, layout, null)).toBeNull();
  });

  it('бой — тап без окна', () => {
    expect(coachFor({ kind: 'battle', id: 'battle' } as Beat, layout, null)).toEqual({
      hole: null,
      gesture: 'tap',
    });
  });

  it('отмена — окно вокруг кнопки, пока кнопки нет — ничего', () => {
    const beat = { kind: 'undo', id: 'undo' } as Beat;
    expect(coachFor(beat, layout, null)).toBeNull();
    expect(coachFor(beat, layout, { x: 10, y: 20, width: 30, height: 40 })).toEqual({
      hole: { x: 4, y: 14, width: 42, height: 52 },
      gesture: 'tap',
      from: { x: 25, y: 40 },
    });
  });

  it('свап — окно над обеими клетками и жест от одной к другой', () => {
    const beat = { kind: 'move', id: 'stone', move: { type: 'swap', from: P(0, 1), to: P(0, 0) } };
    const view = coachFor(beat as Beat, layout, null);
    expect(view).toEqual({
      hole: { x: 96, y: 196, width: 48, height: 88 },
      gesture: 'drag',
      from: { x: 120, y: 260 },
      to: { x: 120, y: 220 },
    });
  });

  it('за край — рука тянет на клетку дальше поля', () => {
    const beat = {
      kind: 'move',
      id: 'tower',
      move: { type: 'nest', from: P(0, 0), direction: 'up' },
    };
    const view = coachFor(beat as Beat, layout, null);
    expect(view?.gesture).toBe('drag');
    expect(view?.from).toEqual({ x: 120, y: 220 });
    expect(view?.to).toEqual({ x: 120, y: 180 });
  });

  it('тап по потиру — тап без жеста перетаскивания', () => {
    const beat = { kind: 'move', id: 'drink', move: { type: 'open', at: P(5, 2) } };
    const view = coachFor(beat as Beat, layout, null);
    expect(view?.gesture).toBe('tap');
    expect(view?.from).toEqual({ x: 320, y: 300 });
    expect(view?.to).toBeUndefined();
  });

  it('без раскладки поля ход не подсвечивается', () => {
    const beat = { kind: 'move', id: 'drink', move: { type: 'open', at: P(5, 2) } };
    expect(coachFor(beat as Beat, null, null)).toBeNull();
  });
});
