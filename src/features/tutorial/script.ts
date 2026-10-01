import type { Board, Cell, Direction, ResourceId } from '@/entities/board';
import { building, tile } from '@/entities/board';
import type { WaveConfig } from '@/entities/wave';
import type { Position } from '@/shared/lib/geometry';

/**
 * Обучение — первая ночь и первый день целиком по сценарию.
 *
 * Поле, досыпка и волна заданы заранее, поэтому всё предсказуемо: каждый ход
 * подсвечен, другие ходы не проходят, после хода — карточка о том, что
 * получилось. По пути игрок встречает все механики: тройку каждого вида,
 * горгулью в башне замка, потир (питьё и слияние потиров), слияние построек,
 * четвёрку, передвижение постройки, отмену хода и сброс за край. Кровь кончается ровно на последнем
 * шаге — и наступает рассвет с волной, которую эта оборона выдерживает.
 *
 * Поле подобрано программой на движке игры, а тест `app/tutorial.test.ts`
 * проигрывает сценарий целиком: поменялись правила — тест скажет, что
 * обучение сломалось.
 */

/**
 * Поле первой ночи. S — камень, T — терновник, A — прах, F — туман, B — кровь,
 * g — Грубая горгулья.
 */
export const TUTORIAL_LAYOUT: readonly string[] = [
  'ASSTTS',
  'SBBTFT',
  'AAFBBT',
  'BAASSB',
  'FFAFBg',
  'FAFBBg',
];

/** Сид досыпки: с ним новые плитки не складывают случайных троек. */
export const TUTORIAL_REFILL_SEED = 3;

const CODE: Readonly<Record<string, ResourceId>> = {
  S: 'stone',
  T: 'thorn',
  A: 'ash',
  F: 'fog',
  B: 'blood',
};

export function tutorialBoard(): Board {
  const cells: Cell[] = TUTORIAL_LAYOUT.flatMap((row) =>
    [...row].map((code) =>
      code === 'g' ? building('gargoyle', 'raw') : tile(CODE[code] as ResourceId),
    ),
  );
  return { width: (TUTORIAL_LAYOUT[0] as string).length, height: TUTORIAL_LAYOUT.length, cells };
}

/** Первый день: четыре охотника по очереди — оборона обучения их выдерживает. */
export const TUTORIAL_WAVE: WaveConfig = {
  spawns: [1, 2, 4, 3].map((column, index) => ({
    id: `tutorial-${String(index)}`,
    kind: 'hunter',
    column,
    atSecond: index * 1.5,
  })),
};

export type TutorialMove =
  | { readonly type: 'swap'; readonly from: Position; readonly to: Position }
  | { readonly type: 'open'; readonly at: Position }
  | { readonly type: 'drop'; readonly from: Position; readonly direction: Direction }
  | { readonly type: 'nest'; readonly from: Position; readonly direction: Direction };

/** Имя шага — ключ его текстов (`widgets/tutorial/texts.ts`). */
export type BeatId =
  | 'stone'
  | 'gargoyle'
  | 'drops'
  | 'tower'
  | 'towered'
  | 'thorn'
  | 'vine'
  | 'ash'
  | 'mortar'
  | 'blood'
  | 'potion'
  | 'drink'
  | 'merge'
  | 'merged'
  | 'fog'
  | 'fogveil'
  | 'move'
  | 'undo'
  | 'drop'
  | 'dawn'
  | 'battle'
  | 'end';

export type Beat =
  /** Ждём ровно этот ход; клетки хода подсвечены. */
  | { readonly kind: 'move'; readonly id: BeatId; readonly move: TutorialMove }
  /** Ждём нажатия кнопки отмены хода. */
  | { readonly kind: 'undo'; readonly id: BeatId }
  /** Карточка: что получилось. Поле ждёт, пока её закроют. */
  | {
      readonly kind: 'card';
      readonly id: BeatId;
      readonly frame: string;
      /**
       * Чью зону атаки подсветить на поле, пока висит карточка: клетка
       * постройки; над полем (y = −1) — башня замка.
       */
      readonly zone?: Position;
    }
  /** Кровь кончилась: карточка про рассвет, по её закрытию — бой. */
  | { readonly kind: 'dawn'; readonly id: BeatId; readonly frame: string }
  /** Идёт бой: подсказка поверх, ничего не ждём. */
  | { readonly kind: 'battle'; readonly id: BeatId }
  /** После боя: обучение пройдено. */
  | { readonly kind: 'end'; readonly id: BeatId; readonly frame: string };

const P = (x: number, y: number): Position => ({ x, y });

export const TUTORIAL_BEATS: readonly Beat[] = [
  // Горгулья встаёт в левом верхнем углу — прямо под башней замка.
  { kind: 'move', id: 'stone', move: { type: 'swap', from: P(0, 1), to: P(0, 0) } },
  { kind: 'card', id: 'gargoyle', frame: 'gargoyle-raw', zone: P(0, 0) },
  // Кровь — отдельной карточкой: с горгульей она не связана.
  { kind: 'card', id: 'drops', frame: 'tile-blood' },
  { kind: 'move', id: 'tower', move: { type: 'nest', from: P(0, 0), direction: 'up' } },
  { kind: 'card', id: 'towered', frame: 'gargoyle-raw', zone: P(0, -1) },
  { kind: 'move', id: 'thorn', move: { type: 'swap', from: P(5, 1), to: P(5, 0) } },
  { kind: 'card', id: 'vine', frame: 'vine-raw', zone: P(5, 0) },
  { kind: 'move', id: 'blood', move: { type: 'swap', from: P(5, 3), to: P(5, 2) } },
  { kind: 'card', id: 'potion', frame: 'potion-raw' },
  { kind: 'move', id: 'drink', move: { type: 'open', at: P(5, 2) } },
  // Двигать и отменять — пока крови с потира хватает: отмена её вернёт.
  { kind: 'move', id: 'move', move: { type: 'swap', from: P(5, 1), to: P(5, 2) } },
  { kind: 'undo', id: 'undo' },
  { kind: 'move', id: 'ash', move: { type: 'swap', from: P(2, 3), to: P(2, 2) } },
  { kind: 'card', id: 'mortar', frame: 'mortar-raw', zone: P(2, 2) },
  { kind: 'move', id: 'merge', move: { type: 'swap', from: P(5, 2), to: P(5, 3) } },
  { kind: 'card', id: 'merged', frame: 'gargoyle-bone', zone: P(5, 5) },
  { kind: 'move', id: 'fog', move: { type: 'swap', from: P(2, 5), to: P(2, 4) } },
  { kind: 'card', id: 'fogveil', frame: 'fogveil-raw', zone: P(2, 4) },
  { kind: 'move', id: 'drop', move: { type: 'drop', from: P(0, 5), direction: 'down' } },
  { kind: 'dawn', id: 'dawn', frame: 'hunter-1' },
  { kind: 'battle', id: 'battle' },
  { kind: 'end', id: 'end', frame: 'gargoyle-bone' },
];

const same = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

/** Ход игрока — тот, которого ждёт шаг? Свап — в любую сторону. */
export function isExpectedMove(
  beat: Beat | undefined,
  move: { readonly type: string } & Partial<Record<'from' | 'to' | 'at', Position>> & {
      readonly direction?: Direction;
    },
): boolean {
  if (beat?.kind !== 'move') return false;
  const want = beat.move;
  if (want.type !== move.type) return false;
  switch (want.type) {
    case 'swap': {
      const { from, to } = move;
      if (from === undefined || to === undefined) return false;
      return (
        (same(from, want.from) && same(to, want.to)) || (same(from, want.to) && same(to, want.from))
      );
    }
    case 'drop':
    case 'nest':
      return (
        move.from !== undefined && same(move.from, want.from) && move.direction === want.direction
      );
    default:
      return move.at !== undefined && same(move.at, want.at);
  }
}

/** Клетки, которые подсвечивает шаг хода. */
export function focusCells(beat: Beat | undefined): Position[] {
  if (beat?.kind !== 'move') return [];
  const { move } = beat;
  if (move.type === 'swap') return [move.from, move.to];
  if (move.type === 'drop' || move.type === 'nest') return [move.from];
  return [move.at];
}

/** Шаг, на котором висит карточка и поле ждёт её закрытия. */
export function isCard(beat: Beat | undefined): boolean {
  return beat?.kind === 'card' || beat?.kind === 'dawn' || beat?.kind === 'end';
}
