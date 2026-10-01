import type { MoveStage } from '@/entities/board';
import { applyRefill } from '@/entities/board';

import type { RunOptions, RunState } from './run';
import { stepInTwilight } from './run';
import type { PlayerMove, TwilightStep } from './twilight';
import { canPlay } from './twilight';

/**
 * Выходной — «Rearrange Day» оригинала: «рабочие замка вышли помочь всё
 * переставить».
 *
 * Предлагается в начале каждой ночи после ночи босса — 11, 21, 31… (в
 * оригинале условие `день % 10 == 1`), пока его не взяли: выходной один на
 * забег, отказ — не в счёт. Согласился — поле этой ночи можно перестроить как
 * угодно, но ничего нового не соберёшь:
 *   • свапы бесплатные и без счёта;
 *   • новые плитки не падают — собранные тройки оставляют пустые клетки, в
 *     которые можно двигать соседей;
 *   • бонусов крови нет: длинные ряды и комбо ничего не дают, потиры не пьются
 *     (в оригинале прямо: «не открывай сундуки и не собирай четвёрки»);
 *   • сбросить за край нельзя — на место сброшенного ничего не упадёт;
 *   • всё оседает вниз: передвинул плитку или постройку в пустую клетку —
 *     над ней столбец падает (`refill: false` в разрешении хода).
 * «Готово» — пустые клетки засыпаются, и наступает рассвет, как после любой
 * ночи: враги идут на перестроенное поле.
 */
/** С какой высоты над дырой падают новые плитки после выходного, клеток. */
const DROP_FROM = 3;

export function isDayOffNight(night: number, every: number): boolean {
  return night > 1 && night % every === 1;
}

/** Предложить ли выходной в эту ночь: ночь подходит и его ещё не брали. */
export function canTakeDayOff(state: RunState, every: number): boolean {
  return isDayOffNight(state.night, every) && state.dayOffTaken !== true && state.dayOff !== true;
}

/** Взять выходной. */
export function startDayOff(state: RunState): RunState {
  return { ...state, dayOff: true, dayOffTaken: true };
}

/** Правила хода в выходной: бесплатно, без досыпки и без бонусов крови. */
export function dayOffOptions(options: RunOptions): RunOptions {
  return {
    ...options,
    costs: { swap: 0, drop: 0, open: 0, item: 0, nest: 0 },
    refill: false,
    longMatchFrom: Number.POSITIVE_INFINITY,
    longMerge: undefined,
    comboFrom: undefined,
  };
}

/** В выходной двигают и ставят в башню — больше ничего. */
export function canPlayDayOff(state: RunState, move: PlayerMove, options: RunOptions): boolean {
  if (move.type !== 'swap' && move.type !== 'nest') return false;
  return canPlay(
    { board: state.board, purse: state.purse, inventory: state.inventory, nests: state.nests },
    move,
    dayOffOptions(options),
  );
}

export function stepDayOff(
  state: RunState,
  move: PlayerMove,
  options: RunOptions,
): { run: RunState; step: TwilightStep } {
  return stepInTwilight(state, move, dayOffOptions(options));
}

/**
 * «Готово»: перестановка кончилась. Пустые клетки засыпаются — сцене отдаются
 * шаги, чтобы новые плитки упали, а не появились, — и кровь ночи тратится до
 * нуля: дальше рассвет, как после любой ночи (`runDawn`). Засыпка может сложить
 * тройку — она схлопывается, как каскад в обычный ход (`applyRefill`); раньше
 * поле только засыпалось, и тройка так и лежала.
 */
export function finishDayOff(
  state: RunState,
  options: RunOptions,
): { run: RunState; stages: MoveStage[] } {
  const result = applyRefill(state.board, options);
  // Первый шаг — пустой «ход»: на «Готово» игрок ничего не двигал.
  const [, first, ...rest] = result.stages;
  // Новые плитки падают с высоты, а не на клетку-две: после выходного дыр
  // бывает немного, и короткое падение глаз не замечает. Карта — только для
  // анимации, на поле это не влияет. Каскад дальше падает как обычно.
  const stages: MoveStage[] =
    first === undefined
      ? []
      : [
          {
            ...first,
            fallen: new Map(
              [...first.fallen].map(([index, distance]) => [index, distance + DROP_FROM]),
            ),
          },
          ...rest,
        ];
  return {
    run: {
      ...state,
      board: result.board,
      dayOff: undefined,
      purse: { ...state.purse, swaps: 0, spent: state.purse.spent + state.purse.swaps },
    },
    // Шаг — даже если засыпать нечего: по его концу сцена зовёт рассвет.
    stages,
  };
}
