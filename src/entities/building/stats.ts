import type { Direction } from '@/shared/lib/geometry';

import type { BuildingId } from './kind';
import { BUILDINGS } from './kind';
import type { Tier } from './tier';

/**
 * Схемы огня (§7). Четыре постройки — четыре разные роли, и если две схемы
 * начнут делать одно и то же, значит цифры сняты неверно.
 *
 *   around — горгулья: во все стороны, радиус в клетках
 *   column — лоза: весь свой столбец, вверх и вниз, сквозь постройки
 *   row    — мортира: весь свой ряд, влево и вправо, сквозь постройки
 *   none   — завеса тумана: не стреляет вовсе, её работа — замедлять
 *
 *   single, beam — прежние лучи по направлению (одна цель / вся линия до
 *   первой постройки). Сейчас ими никто не стреляет; оставлены, пока цифры
 *   не сняты с оригинала и решение про «всю линию» можно пересмотреть.
 *
 * У «всей линии» дальности нет: `range` для column и row не читается.
 */
export type FirePattern = 'around' | 'column' | 'row' | 'single' | 'beam' | 'none';

/** Что считать «радиусом 1»: восемь клеток вокруг или четыре по сторонам. */
export type AroundShape = 'chebyshev' | 'manhattan';

export interface TierStats {
  readonly damage: number;
  readonly shotsPerSecond: number;
  readonly range: number;
  /** Насколько замедляет проходящего охотника. Пока только у тумана. */
  readonly slowFactor: number;
}

/** Сколько целей задевает выстрел: одну или всех накрытых. */
export type Targeting = 'one' | 'all';

/**
 * Кого из врагов в зоне бьёт «одна цель» (снято с оригинала):
 *   gate     — ближайшего к воротам;
 *   nearest  — ближайшего к постройке; раненых — охотнее, а того, кого уже
 *              добивают летящие снаряды, — неохотно (горгулья);
 *   vertical — ближайшего по вертикали (лоза);
 *   facing     — сначала тех, кто с той стороны, куда постройка смотрит;
 *   horizontal — ближайшего по горизонтали, с любой стороны: постройка сама
 *                поворачивается к нему (мортира).
 */
export type TargetChoice = 'gate' | 'nearest' | 'vertical' | 'facing' | 'horizontal';

export interface BuildingSpec {
  readonly pattern: FirePattern;
  readonly targets: Targeting;
  /** Как выбирается цель. Не задано — ближайший к воротам. */
  readonly targeting?: TargetChoice | undefined;
  /**
   * Где внутри клетки завеса замедляет: доли высоты клетки сверху, [от, до].
   * В оригинале — с 10 % по 60 %. Не задано — на всей клетке.
   */
  readonly slowZone?: readonly [number, number] | undefined;
  readonly aroundShape: AroundShape;
  readonly defaultFacing: Direction;
  readonly blockedByBuildings: boolean;
  /** Сняты ли цифры с оригинала. false — стоят заглушки, см. docs/unknowns.md. */
  readonly verified: boolean;
  readonly tiers: Readonly<Record<Tier, TierStats>>;
}

export type BuildingBook = Readonly<Record<BuildingId, BuildingSpec>>;

export function specFor(book: BuildingBook, kind: BuildingId): BuildingSpec {
  return book[kind];
}

export function statsFor(book: BuildingBook, kind: BuildingId, tier: Tier): TierStats {
  return book[kind].tiers[tier];
}

/** Постройки, чьи цифры ещё не сняты с оригинала. */
export function unverifiedBuildings(book: BuildingBook): BuildingId[] {
  return BUILDINGS.filter((kind) => !book[kind].verified);
}

/**
 * Есть ли у постройки направление. §9 выводит это из того, что мортиру в гнезде
 * можно развернуть; круговой огонь и туман от поворота не меняются, поэтому
 * разворачивать их бессмысленно.
 */
export function isDirectional(pattern: FirePattern): boolean {
  return pattern === 'single' || pattern === 'beam';
}
