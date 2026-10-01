import type { ResourceId } from '@/entities/board';
import { POTION_TINT, TILE_TINT } from '@/shared/art';

/**
 * Цвета поля для заглушек — пока нет атласа (docs/atlas.md). Держим их в одном
 * файле, чтобы замена была одной правкой, а не охотой по сцене.
 *
 * Каждому ресурсу своя форма, а не только цвет: играют на улице, при солнце, на
 * дешёвых экранах, и часть игроков не различает цвета.
 */
/** Цвет ресурса и потира живёт в `shared/art`: те же плитки рисует и справка. */
export const TILE_COLOR: Readonly<Record<ResourceId, number>> = TILE_TINT;

export const POTION_COLOR = POTION_TINT;

/**
 * Метка ступени — точки на постройке. Их число и есть ступень; цвет только
 * добавляет читаемости, поэтому все оттенки светлые: тёмная точка на тёмной
 * клетке не видна вовсе.
 */
export const TIER_PIP: readonly number[] = [0xe8dced, 0xffe9ee, 0xffd166, 0xff8a5c];

export const SHOT_COLOR = 0xffe9ee;
export const DAMAGE_COLOR = 0xffd166;

export const CELL_GAP = 0.08;
