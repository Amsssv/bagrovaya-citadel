import { WATER_PALETTE } from './water';

/**
 * Свет над полем: ночью Сумерки, днём Рассвет и бой.
 *
 * Тонируются только поле, вода вокруг него и замок — декорация. Плитки и
 * постройки остаются в своих цветах: цвет плитки несёт смысл и ночью обязан
 * читаться так же, как днём.
 *
 * День — исходный арт без тинта. Ночь — холодная синева: поле темнеет, но не
 * до черноты, иначе поле потеряется в воде.
 */
export const DAY_TINT = 0xffffff;
export const NIGHT_TINT = 0x8a86c8;

/** Сколько длится смена дня и ночи, мс при скорости 1×. */
export const DAYLIGHT_MS = 1200;

function channel(tint: number, shift: number): number {
  return (tint >> shift) & 0xff;
}

/** Смешать два тинта 0xRRGGBB: `t = 0` — первый, `t = 1` — второй. */
export function mixTint(from: number, to: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  let mixed = 0;
  for (const shift of [16, 8, 0]) {
    const a = channel(from, shift);
    const b = channel(to, shift);
    mixed |= Math.round(a + (b - a) * k) << shift;
  }
  return mixed;
}

/** Тинт декорации при доле дня `t`: 0 — глубокая ночь, 1 — полный день. */
export function lightTint(t: number): number {
  return mixTint(NIGHT_TINT, DAY_TINT, t);
}

/** Перемножить два тинта Phaser по каналам — цвет под освещением. */
export function multiplyTint(color: number, light: number): number {
  const channel = (shift: number): number =>
    Math.round((((color >> shift) & 0xff) * ((light >> shift) & 0xff)) / 255);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Цвет воды одной заливкой — основной тон плитки воды (water.ts). Им вода
 * закрашена, пока канвас не поднялся: за игрой (`Water`) и на первом кадре.
 * Дальше воду рисует сцена — плиткой, на весь экран.
 */
export const WATER_COLOR = WATER_PALETTE.base;

/** Вода при доле дня `t` — тем же светом, что и поле. */
export function waterColor(t: number): number {
  return multiplyTint(WATER_COLOR, lightTint(t));
}

/** Цвет Phaser (0xRRGGBB) — для CSS. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
