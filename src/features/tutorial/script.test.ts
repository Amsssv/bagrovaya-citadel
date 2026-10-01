import { describe, expect, it } from 'vitest';

import { findMatches } from '@/entities/board';

import type { Beat } from './script';
import {
  TUTORIAL_BEATS,
  TUTORIAL_LAYOUT,
  TUTORIAL_WAVE,
  focusCells,
  isCard,
  isExpectedMove,
  tutorialBoard,
} from './script';

const P = (x: number, y: number) => ({ x, y });
const swapBeat: Beat = {
  kind: 'move',
  id: 'stone',
  move: { type: 'swap', from: P(2, 1), to: P(2, 0) },
};

describe('поле обучения', () => {
  it('6 × 6 по описанию, без готовых троек', () => {
    const board = tutorialBoard();
    expect(board.width).toBe(6);
    expect(board.height).toBe(6);
    expect(board.cells).toHaveLength(36);
    expect(findMatches(board)).toEqual([]);
  });

  it('две Грубые горгульи уже стоят — под слияние', () => {
    const gargoyles = tutorialBoard().cells.filter(
      (cell) => cell.kind === 'building' && cell.building === 'gargoyle' && cell.tier === 'raw',
    );
    expect(gargoyles).toHaveLength(2);
    expect(TUTORIAL_LAYOUT.join('').split('g')).toHaveLength(3);
  });

  it('волна первого дня — четыре охотника в разных столбцах', () => {
    expect(TUTORIAL_WAVE.spawns).toHaveLength(4);
    expect(new Set(TUTORIAL_WAVE.spawns.map((spawn) => spawn.column)).size).toBe(4);
  });
});

describe('сценарий', () => {
  it('знакомит со всем: каждая постройка, потир, слияние, отмена, сброс за край', () => {
    const ids = TUTORIAL_BEATS.map((beat) => beat.id);
    for (const id of [
      'gargoyle',
      'drops',
      'vine',
      'mortar',
      'potion',
      'drink',
      'merged',
      'fogveil',
      'undo',
      'drop',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('кончается рассветом, боем и итогом', () => {
    expect(TUTORIAL_BEATS.slice(-3).map((beat) => beat.kind)).toEqual(['dawn', 'battle', 'end']);
  });

  it('имена шагов не повторяются', () => {
    const ids = TUTORIAL_BEATS.map((beat) => beat.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('ожидаемый ход', () => {
  it('свап — в любую сторону', () => {
    expect(isExpectedMove(swapBeat, { type: 'swap', from: P(2, 1), to: P(2, 0) })).toBe(true);
    expect(isExpectedMove(swapBeat, { type: 'swap', from: P(2, 0), to: P(2, 1) })).toBe(true);
    expect(isExpectedMove(swapBeat, { type: 'swap', from: P(0, 0), to: P(1, 0) })).toBe(false);
    expect(isExpectedMove(swapBeat, { type: 'swap' })).toBe(false);
  });

  it('другой вид хода не проходит', () => {
    expect(isExpectedMove(swapBeat, { type: 'open', at: P(2, 1) })).toBe(false);
  });

  it('тап — по той самой клетке', () => {
    const tap: Beat = { kind: 'move', id: 'drink', move: { type: 'open', at: P(2, 2) } };
    expect(isExpectedMove(tap, { type: 'open', at: P(2, 2) })).toBe(true);
    expect(isExpectedMove(tap, { type: 'open', at: P(1, 2) })).toBe(false);
    expect(isExpectedMove(tap, { type: 'open' })).toBe(false);
  });

  it('сброс — та клетка и то направление', () => {
    const drop: Beat = {
      kind: 'move',
      id: 'drop',
      move: { type: 'drop', from: P(0, 5), direction: 'down' },
    };
    expect(isExpectedMove(drop, { type: 'drop', from: P(0, 5), direction: 'down' })).toBe(true);
    expect(isExpectedMove(drop, { type: 'drop', from: P(0, 5), direction: 'left' })).toBe(false);
    expect(isExpectedMove(drop, { type: 'drop', direction: 'down' })).toBe(false);
  });

  it('на карточке и без обучения ходов не ждём', () => {
    expect(
      isExpectedMove({ kind: 'card', id: 'vine', frame: 'x' }, { type: 'open', at: P(0, 0) }),
    ).toBe(false);
    expect(isExpectedMove(undefined, { type: 'open', at: P(0, 0) })).toBe(false);
  });
});

describe('подсветка и карточки', () => {
  it('свап подсвечивает обе клетки, тап и сброс — одну', () => {
    expect(focusCells(swapBeat)).toHaveLength(2);
    expect(focusCells({ kind: 'move', id: 'drink', move: { type: 'open', at: P(2, 2) } })).toEqual([
      P(2, 2),
    ]);
    expect(
      focusCells({
        kind: 'move',
        id: 'drop',
        move: { type: 'drop', from: P(0, 5), direction: 'down' },
      }),
    ).toEqual([P(0, 5)]);
    expect(focusCells({ kind: 'undo', id: 'undo' })).toEqual([]);
  });

  it('карточки — карточка, рассвет и итог', () => {
    expect(isCard({ kind: 'card', id: 'vine', frame: 'x' })).toBe(true);
    expect(isCard({ kind: 'dawn', id: 'dawn', frame: 'x' })).toBe(true);
    expect(isCard({ kind: 'end', id: 'end', frame: 'x' })).toBe(true);
    expect(isCard({ kind: 'battle', id: 'battle' })).toBe(false);
    expect(isCard(swapBeat)).toBe(false);
    expect(isCard(undefined)).toBe(false);
  });
});
