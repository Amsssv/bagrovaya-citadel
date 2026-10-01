import { describe, expect, it } from 'vitest';

import { findMatches } from '@/entities/board';
import { boardFrom } from '@/entities/board/__testing__/boardFrom';
import { createCitadel, createNests } from '@/entities/citadel';
import { createInventory } from '@/entities/item';
import { EMPTY_STATS, createPurse } from '@/entities/player';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { ECONOMY_CONFIG, POTION_SWAPS } from '@/shared/config/economy';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { createRng } from '@/shared/lib/rng';

import {
  canPlayDayOff,
  canTakeDayOff,
  finishDayOff,
  isDayOffNight,
  startDayOff,
  stepDayOff,
} from './dayOff';
import type { RunOptions, RunState } from './run';

function options(): RunOptions {
  return {
    rng: createRng(1),
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    costs: ECONOMY_CONFIG.costs,
    potionSwaps: POTION_SWAPS,
    longMatchFrom: ECONOMY_CONFIG.longMatchFrom,
    longMerge: ECONOMY_CONFIG.longMerge,
    comboFrom: ECONOMY_CONFIG.comboFrom,
    swapsPerNight: 5,
    enemies: ENEMY_BOOK,
    buildings: BUILDING_BOOK,
    tickMs: 50,
    maxSeconds: 30,
    waveFor: () => ({ spawns: [] }),
  };
}

// Строка 0: s s t s — свап (3,0)↔(2,0) собирает три камня.
const BOARD = boardFrom(`
  s s t s b f
  f b a f s t
  a f b a t s
  t a P s f b
  b s t a f a
  f t a b s t
`);

function state(): RunState {
  return startDayOff({
    board: BOARD,
    citadel: createCitadel(5, 36),
    purse: createPurse(5),
    inventory: createInventory(),
    nests: createNests(CITADEL_CONFIG.nests),
    night: 11,
    stats: EMPTY_STATS,
  });
}

describe('выходной — день перестановки', () => {
  it('предлагается после каждой ночи босса: 11, 21, 31…, но не в первую', () => {
    expect([1, 10, 11, 12, 21, 31, 41].map((night) => isDayOffNight(night, 10))).toEqual([
      false,
      false,
      true,
      false,
      true,
      true,
      true,
    ]);
  });

  it('выходной один на забег: взятый больше не предлагают, отказ — не в счёт', () => {
    const taken = state();
    expect(canTakeDayOff(taken, 10)).toBe(false);
    const later = finishDayOff(taken, options()).run;
    expect(canTakeDayOff({ ...later, night: 21 }, 10)).toBe(false);
    const declined = { ...taken, dayOff: undefined, dayOffTaken: undefined };
    expect(canTakeDayOff(declined, 10)).toBe(true);
    expect(canTakeDayOff({ ...declined, night: 12 }, 10)).toBe(false);
  });

  it('передвинутое в пустую клетку оседает: столбец над дырой падает', () => {
    // Тройка камней в верхнем ряду оставляет дыры в (0,0) и (1,0) — их
    // не засыпает. Горгулью из (3,3) поднимают в дыру, и под ней оказывается
    // пустота: она падает вниз, на своё место в столбце.
    const first = stepDayOff(
      state(),
      { type: 'swap', from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
      options(),
    ).run;
    const lifted = stepDayOff(
      first,
      { type: 'swap', from: { x: 1, y: 1 }, to: { x: 1, y: 0 } },
      options(),
    ).run;
    const column = [0, 1, 2, 3, 4, 5].map((y) => lifted.board.cells[y * 6 + 1]?.kind);
    expect(column[0]).toBe('empty');
    expect(column.slice(1).every((kind) => kind !== 'empty')).toBe(true);
  });

  it('ходы бесплатные и досыпки нет: тройка оставляет пустые клетки', () => {
    const { run, step } = stepDayOff(
      state(),
      { type: 'swap', from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
      options(),
    );
    expect(run.purse.swaps).toBe(5);
    expect(step.move.refilled).toBe(false);
    expect(run.board.cells.some((cell) => cell.kind === 'empty')).toBe(true);
  });

  it('двигать и ставить в башню можно, пить потир и сбрасывать за край — нет', () => {
    const run = state();
    expect(
      canPlayDayOff(run, { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, options()),
    ).toBe(true);
    expect(canPlayDayOff(run, { type: 'open', at: { x: 2, y: 3 } }, options())).toBe(false);
    expect(
      canPlayDayOff(run, { type: 'drop', from: { x: 0, y: 5 }, direction: 'down' }, options()),
    ).toBe(false);
  });

  it('«Готово»: пустое засыпается падением, кровь ночи потрачена — дальше рассвет', () => {
    const { run } = stepDayOff(
      state(),
      { type: 'swap', from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
      options(),
    );
    const { run: next, stages } = finishDayOff(run, options());
    expect(next.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
    expect(stages[0]?.kind).toBe('settle');
    expect(stages[0]?.fallen.size).toBeGreaterThan(0);
    expect(next.purse.swaps).toBe(0);
    expect(next.night).toBe(11);
    expect(next.dayOff).toBeUndefined();
  });
  it('«Готово»: тройка, сложенная засыпкой, схлопывается — как каскад в обычный ход', () => {
    // Три дыры в верхнем ряду, а досыпать нечем, кроме тумана: засыпка
    // обязательно сложит тройку тумана. Раньше она так и оставалась лежать.
    const holes = boardFrom(`
      . . . s b t
      s b a f s t
      a t b a t s
      t a P s f b
      b s t a f a
      f t a b s t
    `);
    // Каскады — как в игре (shared/config/balance.ts, cascadesEnabled).
    const fogOnly = { ...options(), resources: ['fog'] as const, cascadesEnabled: true };
    const { run, stages } = finishDayOff({ ...state(), board: holes }, fogOnly);
    expect(findMatches(run.board)).toEqual([]);
    expect(
      run.board.cells.some((cell) => cell.kind === 'building' && cell.building === 'fogveil'),
    ).toBe(true);
    // Сцене — весь путь: засыпка, тройка, досыпка.
    expect(stages.map((stage) => stage.kind)).toContain('reap');
  });
});
