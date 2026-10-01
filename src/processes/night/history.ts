import type { Rng, RngSnapshot } from '@/shared/lib/rng';

/**
 * Память ночи: что можно отменить и к чему возвращают песочные часы.
 *
 * **Отмена хода — как в оригинале (§3):** ходы складываются в стопку, и
 * отменять можно сколько угодно ходов подряд — но только тех, после которых
 * не было досыпки. Ход, вызвавший досыпку, фиксирует всё, что было до него:
 * стопка очищается. Причина механическая: пока досыпки не было, поток
 * случайности не тронут, и возврат точен.
 *
 * Песочные часы (§11) «перезапускают ночь и возвращают всё потраченное» —
 * значит, вместе с состоянием возвращается и поток: перезапуск это доигровка
 * той же ночи, а не пересдача.
 *
 * Тип состояния — параметр: истории всё равно, что именно откатывать, лишь бы
 * это был неизменяемый снимок. Игра хранит здесь забег целиком, тесты — Сумерки.
 */
export interface NightHistory<S> {
  /** Состояния до ходов, которые ещё можно отменить; последний — сверху. */
  readonly undoable: readonly { readonly state: S; readonly rng: RngSnapshot }[];
  /** Начало ночи: состояние и место потока досыпки. */
  readonly nightStart: S;
  readonly nightRng: RngSnapshot;
}

export function openNight<S>(state: S, rng: Rng): NightHistory<S> {
  return { undoable: [], nightStart: state, nightRng: rng.snapshot() };
}

/**
 * Запомнить сделанный ход. `before` и `rng` — состояние и поток **до** хода;
 * `refilled` — была ли после него досыпка: тогда отменять больше нечего.
 */
export function remember<S>(
  history: NightHistory<S>,
  before: S,
  rng: RngSnapshot,
  refilled: boolean,
): NightHistory<S> {
  if (refilled) return { ...history, undoable: [] };
  return { ...history, undoable: [...history.undoable, { state: before, rng }] };
}

export function canUndo<S>(history: NightHistory<S>): boolean {
  return history.undoable.length > 0;
}

/** Сколько ходов подряд можно отменить. */
export function undoDepth<S>(history: NightHistory<S>): number {
  return history.undoable.length;
}

export function undo<S>(history: NightHistory<S>): {
  state: S;
  rng: RngSnapshot;
  history: NightHistory<S>;
} {
  const last = history.undoable.at(-1);
  if (last === undefined) {
    throw new Error('Отменять нечего: ходов без досыпки этой ночью не было');
  }
  return {
    state: last.state,
    rng: last.rng,
    history: { ...history, undoable: history.undoable.slice(0, -1) },
  };
}

/** Песочные часы: вернуть ночь к началу вместе с потоком случайности. */
export function restartNight<S>(history: NightHistory<S>): {
  state: S;
  rng: RngSnapshot;
  history: NightHistory<S>;
} {
  return {
    state: history.nightStart,
    rng: history.nightRng,
    history: { ...history, undoable: [] },
  };
}
