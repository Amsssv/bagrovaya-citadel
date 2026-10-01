import type { BuildingId, Tier } from '@/entities/building';
import type { Direction, Position } from '@/shared/lib/geometry';

// Геометрия общая для поля и построек, поэтому живёт в shared. Здесь только
// пробрасываем наружу, чтобы работающий с полем не ходил за ней отдельно.
export type { Direction, Position };

/**
 * Пять сырых ресурсов на поле (§5). Соответствие «ресурс → постройка» жёсткое.
 */
export type ResourceId = 'stone' | 'thorn' | 'ash' | 'fog' | 'blood';

/**
 * Во что превращается тройка (§5). Кровь даёт не постройку, а потир, поэтому
 * тип результата разный.
 */
export const HARVEST: Readonly<Record<ResourceId, BuildingId | 'potion'>> = {
  stone: 'gargoyle',
  thorn: 'vine',
  ash: 'mortar',
  fog: 'fogveil',
  blood: 'potion',
};

export type Cell =
  | { readonly kind: 'empty' }
  | { readonly kind: 'tile'; readonly resource: ResourceId }
  | {
      readonly kind: 'building';
      readonly building: BuildingId;
      readonly tier: Tier;
      /**
       * Куда смотрит постройка — у мортиры, её разворачивают тапом (как пушку в
       * оригинале). Не задано — по умолчанию для её столбца.
       */
      readonly facing?: 'left' | 'right' | undefined;
    }
  | { readonly kind: 'potion'; readonly tier: Tier };

export type TileCell = Extract<Cell, { kind: 'tile' }>;
export type BuildingCell = Extract<Cell, { kind: 'building' }>;
export type PotionCell = Extract<Cell, { kind: 'potion' }>;

export const EMPTY: Cell = { kind: 'empty' };

// Возвращаем точный вид клетки, а не Cell: иначе каждому, кто строит из них
// что-то своё, приходится сужать тип заново или защищаться проверкой.
export const tile = (resource: ResourceId): TileCell => ({ kind: 'tile', resource });

export const building = (id: BuildingId, tier: Tier): BuildingCell => ({
  kind: 'building',
  building: id,
  tier,
});

export const potion = (tier: Tier): PotionCell => ({ kind: 'potion', tier });

export interface Board {
  readonly width: number;
  readonly height: number;
  /** Плоский массив, индекс = y * width + x. */
  readonly cells: readonly Cell[];
}
