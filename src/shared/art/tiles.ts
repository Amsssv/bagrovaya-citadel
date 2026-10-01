import type { TIER_ARTS } from './buildings';

/**
 * Облик плиток: цвет. Здесь, а не в виджете поля, потому что плитки
 * рисует не только поле — справка показывает те же самые, и цвет ресурса
 * по-прежнему задан в одном месте.
 *
 * Список ресурсов повторяет доменный: `shared` не имеет права знать про
 * `entities`. Сверяет их тест в виджете поля.
 *
 * Оттенки светлые намеренно: поле тёмное, а тёмный глиф на тёмной клетке не
 * читается ни при солнце, ни на дешёвом экране.
 */
export const TILE_ARTS = ['stone', 'thorn', 'ash', 'fog', 'blood'] as const;

export type TileArt = (typeof TILE_ARTS)[number];

export const TILE_TINT: Readonly<Record<TileArt, number>> = {
  stone: 0xa8b6c9,
  thorn: 0xe0587c,
  ash: 0xb6a2e6,
  fog: 0xbfe7ea,
  blood: 0xf05263,
};

export const POTION_TINT = 0xff7a8c;

/** Цвет ступени: камень, кость, обсидиан, багрянец. Все светлые — поле тёмное. */
export const TIER_TINT: Readonly<Record<(typeof TIER_ARTS)[number], number>> = {
  raw: 0xc4b6a8,
  bone: 0xf3e7c6,
  obsidian: 0xb49cff,
  crimson: 0xff5068,
};

/** Тинт Phaser (0xRRGGBB) в цвет CSS — для того же цвета вне канваса. */
export function cssColor(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}
