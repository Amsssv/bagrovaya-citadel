import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Справочник построек (§7) — раздел `buildings` из `balance.ts`. Горгулья взята
 * из таблицы §6 и подтверждена; у лозы, мортиры и завесы цифры выдуманы и
 * помечены `verified: false` (§14 #7).
 *
 * Спорные места, тоже в docs/unknowns.md:
 *   aroundShape        — «радиус 1» это восемь клеток вокруг или четыре
 *   defaultFacing      — куда смотрит постройка; «вниз» = навстречу охотникам
 *   pattern            — лоза бьёт весь свой столбец, мортира — весь свой ряд,
 *                        обе сквозь постройки, со своей клеткой и по одной цели,
 *                        ближайшей к воротам. Решение по продукту
 *   targets у горгульи — «во все стороны» это про охват, а не про число целей:
 *                        одну она бьёт или всех вокруг, §7 не говорит
 *   blockedByBuildings — «ставить что-либо перед ней нельзя» понято как
 *                        перекрытие постройками, но не плитками: поле после
 *                        досыпки всегда полное, и плитки заперли бы мортиру
 *                        навсегда
 */
const TierStatsSchema = z.object({
  damage: z.number().nonnegative(),
  shotsPerSecond: z.number().nonnegative(),
  range: z.int().nonnegative(),
  slowFactor: z.number().min(0).max(1),
});

const BuildingSpecSchema = z.object({
  pattern: z.enum(['around', 'column', 'row', 'single', 'beam', 'none']),
  targets: z.enum(['one', 'all']),
  targeting: z.enum(['gate', 'nearest', 'vertical', 'facing', 'horizontal']).optional(),
  slowZone: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  aroundShape: z.enum(['chebyshev', 'manhattan']),
  defaultFacing: z.enum(['up', 'down', 'left', 'right']),
  blockedByBuildings: z.boolean(),
  verified: z.boolean(),
  tiers: z.object({
    raw: TierStatsSchema,
    bone: TierStatsSchema,
    obsidian: TierStatsSchema,
    crimson: TierStatsSchema,
  }),
});

const BuildingBookSchema = z.object({
  gargoyle: BuildingSpecSchema,
  vine: BuildingSpecSchema,
  mortar: BuildingSpecSchema,
  fogveil: BuildingSpecSchema,
});

export const BUILDING_BOOK = BuildingBookSchema.parse(BALANCE.buildings);
