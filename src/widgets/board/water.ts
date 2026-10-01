import { createRng } from '@/shared/lib/rng';

/**
 * Вода вокруг поля — не заливка, а пиксельный рисунок в духе самой картинки
 * поля: три тона воды перемешаны дизерингом, по ним — штрихи ряби и россыпи
 * бликов. Палитра снята с воды на `field.webp`.
 *
 * Плитка бесшовная: шум и все штрихи заворачиваются через край, и её можно
 * повторять по всему экрану. Считается чистой функцией от сида — одна и та
 * же при каждом запуске — и поэтому проверяется тестами.
 */
export const WATER_PALETTE = {
  // Три самых частых тона воды на картинке поля: плитка того же тона, и
  // рваный край картинки на ней не читается полосой.
  deep: 0x2a0d57,
  base: 0x2f1060,
  light: 0x371166,
  ripple: 0x4a2a8a,
  glint: 0x6448b8,
  spark: 0x8e79d2,
} as const;

/** Сторона плитки, в пикселях воды. */
export const WATER_TILE = 96;
/**
 * Сколько точек картинки поля занимает один пиксель воды: примерно столько
 * же, сколько пиксель арта на `field.webp`, — вода не должна быть мельче поля.
 */
export const WATER_PIXEL = 6;
/** Шаг решётки шума: пятна тона — примерно такого размера, в пикселях воды. */
const NOISE_STEP = 16;

/** Упорядоченный дизеринг 4 × 4 (Байер): пороги от 0 до 1. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export interface WaterTileOptions {
  readonly size?: number;
  readonly seed?: number;
  readonly ripples?: number;
  readonly sparkles?: number;
}

/** Плитка воды: цвет каждого пикселя, построчно, `size × size`. */
export function waterTile(options: WaterTileOptions = {}): number[] {
  const { size = WATER_TILE, seed = 7, ripples = 26, sparkles = 7 } = options;
  const rng = createRng(seed);
  const cells = Math.max(1, Math.round(size / NOISE_STEP));
  const lattice = Array.from({ length: cells * cells }, () => rng.next());
  const at = (x: number, y: number): number =>
    lattice[wrap(y, cells) * cells + wrap(x, cells)] as number;

  const pixels: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tone = smoothNoise(at, (x / size) * cells, (y / size) * cells);
      const threshold = BAYER[(y % 4) * 4 + (x % 4)] as number;
      // Тон 0..2: тёмный — основной — светлый; дробная часть решается
      // дизерингом, как на пиксельной картинке поля.
      const level = tone * 2;
      const index = Math.floor(level) + (level % 1 > threshold ? 1 : 0);
      pixels.push(
        index <= 0 ? WATER_PALETTE.deep : index === 1 ? WATER_PALETTE.base : WATER_PALETTE.light,
      );
    }
  }

  const put = (x: number, y: number, color: number): void => {
    pixels[wrap(y, size) * size + wrap(x, size)] = color;
  };
  // Рябь — короткие горизонтальные штрихи, у длинных приподнята середина.
  for (let i = 0; i < ripples; i++) {
    const x = rng.int(0, size);
    const y = rng.int(0, size);
    const length = rng.int(3, 8);
    for (let dx = 0; dx < length; dx++) put(x + dx, y, WATER_PALETTE.ripple);
    if (length >= 5) {
      for (let dx = 1; dx < length - 1; dx++) put(x + dx, y - 1, WATER_PALETTE.ripple);
    }
  }
  // Блики — крестик с ярким центром, как россыпи на воде у поля.
  for (let i = 0; i < sparkles; i++) {
    const x = rng.int(0, size);
    const y = rng.int(0, size);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      put(x + dx, y + dy, WATER_PALETTE.glint);
    }
    put(x, y, WATER_PALETTE.spark);
  }
  return pixels;
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period;
}

/** Шум на решётке с плавной интерполяцией: решётка сама заворачивается. */
function smoothNoise(at: (x: number, y: number) => number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = ease(x - x0);
  const fy = ease(y - y0);
  const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
  const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
  return top + (bottom - top) * fy;
}

function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Камни, кораллы и деревья в воде — кадры, вырезанные из картинки поля
 * (scripts/water-decor.py). Вид кадра — по началу имени.
 */
export type DecorKind = 'rock' | 'coral' | 'tree';

export interface DecorFrame {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

export interface DecorPlacement {
  readonly frame: string;
  /** Середина нижнего края кадра, в точках картинки поля. */
  readonly x: number;
  readonly y: number;
  readonly flip: boolean;
}

export interface ArtRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScatterOptions {
  /** Что видно на экране, в точках картинки поля (её левый верх — 0, 0). */
  readonly area: ArtRect;
  /** Сама картинка поля: на неё предметы не заходят. */
  readonly field: ArtRect;
  readonly frames: readonly DecorFrame[];
  readonly seed?: number;
}

/** Сторона ячейки расстановки: в каждой — не больше одного предмета. */
export const DECOR_STEP = 300;
/** Сколько воды оставить между предметом и картинкой поля, точек. */
export const DECOR_MARGIN = 40;
/**
 * Доли видов по ячейкам: камней больше всего, деревьев — единицы, треть
 * ячеек пустая, иначе вода превратится в каменоломню.
 */
const DECOR_ODDS: readonly (readonly [DecorKind, number])[] = [
  ['rock', 0.3],
  ['coral', 0.3],
  ['tree', 0.02],
];

export function decorKind(frame: string): DecorKind | null {
  for (const kind of ['rock', 'coral', 'tree'] as const) {
    if (frame.startsWith(`${kind}-`)) return kind;
  }
  return null;
}

/**
 * Расставить предметы по воде. Решение принимает каждая ячейка сама, по своему
 * номеру и сиду, — поэтому расстановка не зависит от размера окна: окно
 * пошире только открывает новые ячейки, старые предметы остаются на местах.
 */
export function scatterDecor(options: ScatterOptions): DecorPlacement[] {
  const { area, field, frames, seed = 11 } = options;
  const byKind = new Map<DecorKind, DecorFrame[]>();
  for (const frame of frames) {
    const kind = decorKind(frame.name);
    if (kind !== null) byKind.set(kind, [...(byKind.get(kind) ?? []), frame]);
  }

  const placements: DecorPlacement[] = [];
  const first = { x: Math.floor(area.x / DECOR_STEP), y: Math.floor(area.y / DECOR_STEP) };
  const last = {
    x: Math.ceil((area.x + area.width) / DECOR_STEP),
    y: Math.ceil((area.y + area.height) / DECOR_STEP),
  };
  for (let row = first.y; row < last.y; row++) {
    for (let column = first.x; column < last.x; column++) {
      const rng = createRng(cellSeed(seed, column, row));
      const kind = rollKind(rng.next());
      const choices = kind === null ? undefined : byKind.get(kind);
      if (choices === undefined || choices.length === 0) continue;
      const frame = rng.pick(choices);
      const x = (column + 0.15 + rng.next() * 0.7) * DECOR_STEP;
      const y = (row + 0.15 + rng.next() * 0.7) * DECOR_STEP;
      const flip = rng.next() < 0.5;
      const box = {
        x: x - frame.width / 2,
        y: y - frame.height,
        width: frame.width,
        height: frame.height,
      };
      if (overlaps(box, field, DECOR_MARGIN)) continue;
      placements.push({ frame: frame.name, x, y, flip });
    }
  }
  return placements;
}

function rollKind(roll: number): DecorKind | null {
  let edge = 0;
  for (const [kind, odds] of DECOR_ODDS) {
    edge += odds;
    if (roll < edge) return kind;
  }
  return null;
}

/** Сид ячейки: соседние ячейки не должны получать похожие числа. */
function cellSeed(seed: number, column: number, row: number): number {
  return (Math.imul(column, 73856093) ^ Math.imul(row, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
}

function overlaps(a: ArtRect, b: ArtRect, margin: number): boolean {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width > b.x - margin &&
    a.y < b.y + b.height + margin &&
    a.y + a.height > b.y - margin
  );
}
