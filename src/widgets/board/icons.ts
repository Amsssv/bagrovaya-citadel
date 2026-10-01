import type { ResourceId } from '@/entities/board';
import type { BuildingId } from '@/entities/building';
import castleArt from '@/shared/assets/board/castle.webp';
import fieldArt from '@/shared/assets/board/field.webp';
import gateGrassArt from '@/shared/assets/board/gate-grass.webp';
import waterDecorMap from '@/shared/assets/board/water-decor.json';
import waterDecorArt from '@/shared/assets/board/water-decor.png';

/**
 * Запасные глифы поля — на случай, если атлас не загрузился. Рисуются кодом
 * (`BoardScene.ensureGlyphs`): простые белые фигуры, цвет — тинтом. Своих
 * картинок под них нет, чужих — тоже: сторонние иконки с лицензией
 * указания авторства убраны 2026-09-29.
 *
 * Растрим в 128 точек: клетка на шестистолбцовом поле даже на крупном экране
 * меньше сотни, и запас в два раза закрывает плотность пикселей.
 */
export const ICON_SIZE = 128;

export const TILE_ICON: Readonly<Record<ResourceId, string>> = {
  stone: 'tile-stone',
  thorn: 'tile-thorn',
  ash: 'tile-ash',
  fog: 'tile-fog',
  blood: 'tile-blood',
};

export const POTION_ICON = 'potion';

/** Постройка — глиф вида; ступень добавляет цвет и плашку. */
export const BUILDING_ICON: Readonly<Record<BuildingId, string>> = {
  gargoyle: 'build-gargoyle',
  vine: 'build-vine',
  mortar: 'build-mortar',
  fogveil: 'build-fogveil',
};

/**
 * Помост с сеткой: своя картинка поля, а не нарисованные клетки. Сетка на ней
 * уже есть, поэтому раскладка обязана сесть ровно на неё.
 */
export const BOARD_ART = 'board-art';

export const BOARD_ART_URL: string = fieldArt;
export const CASTLE_ART = 'field-castle';
export const CASTLE_ART_URL: string = castleArt;
export const GATE_GRASS_ART = 'field-gate-grass';
export const GATE_GRASS_ART_URL: string = gateGrassArt;

/**
 * Поле собирается из трёх картинок: сама земля с сеткой и рамкой (`field`),
 * замок сверху и трава у ворот поверх его подножия. Замок и трава ставятся по
 * пикселям картинки поля — так, как на эталонной сборке художника; сцена
 * масштабирует всё вместе.
 *
 * Сетка — квадраты по 200 точек: с 247 по 1447 по горизонтали и с 821 по 2021
 * по вертикали (картинка 1688 × 2378). Верхний ряд на картинке нарисован выше
 * — с 660, — но эта часть уходит под замок и траву.
 */
export const FIELD_SIZE = { width: 1688, height: 2378 } as const;

/**
 * Камни, кораллы и деревья для воды вокруг поля — вырезаны из картинки поля
 * (scripts/water-decor.py), в её масштабе: точка кадра — точка поля.
 */
export const WATER_DECOR_ART = 'water-decor';
export const WATER_DECOR_URL: string = waterDecorArt;
export const WATER_DECOR_FRAMES: Readonly<Record<string, readonly number[]>> = waterDecorMap.frames;

export const BOARD_GRID_INSET = {
  left: 247 / FIELD_SIZE.width,
  top: 821 / FIELD_SIZE.height,
  right: (FIELD_SIZE.width - 1447) / FIELD_SIZE.width,
  bottom: (FIELD_SIZE.height - 2021) / FIELD_SIZE.height,
} as const;

/** Где на картинке поля лежит замок и трава у ворот (левый верхний угол, масштаб). */
export const CASTLE_LAYER = { x: 121, y: -3, scale: 1 } as const;
export const GATE_GRASS_LAYER = { x: 352, y: 596, scale: 0.97 } as const;

/**
 * Где на круглых башнях замка стоят горгульи из башен (гнёзда): на стене, над
 * полем. Шпили закрывает шапка экрана, поэтому не на них. Точка — ноги
 * горгульи, в пикселях картинки поля.
 */
export const TURRET_SPOTS = {
  left: { x: CASTLE_LAYER.x + 200, y: CASTLE_LAYER.y + 700 },
  right: { x: CASTLE_LAYER.x + 1259, y: CASTLE_LAYER.y + 700 },
} as const;
