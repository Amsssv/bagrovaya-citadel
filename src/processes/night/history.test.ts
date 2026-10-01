import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from '@/entities/board/__testing__/boardFrom';
import { createInventory } from '@/entities/item';
import { createPurse } from '@/entities/player';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import { createRng } from '@/shared/lib/rng';

import type { NightHistory } from './history';
import { canUndo, openNight, remember, restartNight, undo, undoDepth } from './history';
import { playMove } from './twilight';
import type { PlayerMove, TwilightOptions, TwilightState } from './twilight';

function options(seed = 1): TwilightOptions {
  return {
    rng: createRng(seed).fork('refill'),
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    costs: ECONOMY_CONFIG.costs,
    potionSwaps: { raw: 3, bone: 12, obsidian: 70, crimson: 400 },
    longMatchFrom: 4,
  };
}

/** Верхний ряд: свап камня с терновником тройки не даёт — досыпки не будет. */
const board = boardFrom(`
  s t a f b
  t a f b s
  a f b s t
  f b s t a
`);

const state = (swaps = 20): TwilightState => ({
  board,
  purse: createPurse(swaps),
  inventory: createInventory({ 'cursed-ash': 1 }),
});

const quiet: PlayerMove = { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } };

/** Сделать ход и запомнить его так, как это делает игра. */
function played(
  history: NightHistory<TwilightState>,
  before: TwilightState,
  move: PlayerMove,
  opts: TwilightOptions,
) {
  const rng = opts.rng.snapshot();
  const step = playMove(before, move, opts);
  return { history: remember(history, before, rng, step.move.refilled), step };
}

describe('отмена хода — как в оригинале (§3)', () => {
  it('в начале ночи отменять нечего', () => {
    expect(canUndo(openNight(state(), createRng(1)))).toBe(false);
  });

  it('ход без досыпки можно отменить', () => {
    const before = state();
    const { history } = played(openNight(before, createRng(1)), before, quiet, options());
    expect(canUndo(history)).toBe(true);
  });

  it('отмена возвращает и поле, и кошелёк', () => {
    const before = state(20);
    const { history } = played(openNight(before, createRng(1)), before, quiet, options());

    const back = undo(history);
    expect(pictureOf(back.state.board)).toBe(pictureOf(before.board));
    expect(back.state.purse.swaps).toBe(20);
  });

  it('отменять можно несколько ходов подряд — сколько угодно', () => {
    const opts = options();
    const start = state(20);
    let history = openNight(start, createRng(1));
    let current = start;
    for (let i = 0; i < 3; i++) {
      const next = played(history, current, quiet, opts);
      history = next.history;
      current = next.step.state;
    }
    expect(undoDepth(history)).toBe(3);

    let back = undo(history);
    back = undo(back.history);
    back = undo(back.history);
    expect(back.state.purse.swaps).toBe(20);
    expect(canUndo(back.history)).toBe(false);
  });

  it('отменять нечего — ошибка, а не тихий возврат того же', () => {
    expect(() => undo(openNight(state(), createRng(1)))).toThrow();
  });
});

describe('ход зафиксирован досыпкой (§3)', () => {
  const ready = boardFrom(`
    s s t s b
    f b a f s
    a f b a t
    b s f t a
  `);
  const matching: PlayerMove = { type: 'swap', from: { x: 3, y: 0 }, to: { x: 2, y: 0 } };
  const before: TwilightState = {
    board: ready,
    purse: createPurse(20),
    inventory: createInventory(),
  };

  it('ход с тройкой отменить нельзя: сверху уже упали новые', () => {
    const { history, step } = played(openNight(before, createRng(1)), before, matching, options());
    expect(step.move.refilled).toBe(true);
    expect(canUndo(history)).toBe(false);
  });

  it('досыпка фиксирует и ходы до неё', () => {
    const opts = options();
    // Сначала тихий ход на другом поле — его можно было бы отменить…
    const quietBoard = state(20);
    const first = played(openNight(quietBoard, createRng(1)), quietBoard, quiet, opts);
    expect(canUndo(first.history)).toBe(true);
    // …а потом ход с досыпкой: стопка очищается целиком.
    const second = played(first.history, before, matching, opts);
    expect(canUndo(second.history)).toBe(false);
  });
});

describe('песочные часы перезапускают ночь (§11)', () => {
  it('возвращают поле, кошелёк и предметы на начало ночи', () => {
    const start = state(20);
    const opts = options();
    let history = openNight(start, createRng(7));

    let current = start;
    for (let i = 0; i < 3; i++) {
      const next = played(history, current, quiet, opts);
      history = next.history;
      current = next.step.state;
    }
    expect(current.purse.swaps).toBe(17);

    const restarted = restartNight(history);
    expect(pictureOf(restarted.state.board)).toBe(pictureOf(start.board));
    expect(restarted.state.purse.swaps).toBe(20);
    expect(restarted.state.inventory).toEqual(start.inventory);
  });

  it('вместе с ночью возвращается и поток случайности', () => {
    // Перезапуск — это доигровка той же ночи, а не пересдача: иначе часами
    // можно было бы крутить досыпку до удобной раздачи.
    const rng = createRng(7).fork('refill');
    const start = state();
    const history = openNight(start, rng);
    rng.next();
    rng.next();

    expect(restartNight(history).rng.state).toBe(createRng(7).fork('refill').snapshot().state);
  });

  it('после перезапуска отменять нечего', () => {
    const start = state();
    const opts = options();
    const { history } = played(openNight(start, createRng(7)), start, quiet, opts);

    expect(canUndo(restartNight(history).history)).toBe(false);
  });

  it('новая ночь открывается с нового состояния', () => {
    const start = state(20);
    const opts = options();
    const step = playMove(start, quiet, opts);
    const next = openNight(step.state, createRng(7));

    expect(restartNight(next).state.purse.swaps).toBe(19);
  });
});
