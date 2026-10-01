import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Экономика крови (§3, §8): раздел `economy` из `balance.ts`. Цифры и что они
 * значат — там; здесь схема, по которой раздел проверяется при запуске.
 *
 * Открытые вопросы к спеке (docs/unknowns.md):
 *   startSwaps   — §14 #5, сколько даётся в начале забега;
 *   potions.raw  — §14 #11, единственная неизвестная ступень потира;
 *   costs        — что свап стоит единицу, следует из §3; что столько же стоит
 *                  сброс за край — наше допущение.
 */
const PotionSchema = z.object({
  swaps: z.int().nonnegative(),
  verified: z.boolean(),
});

const EconomyConfigSchema = z.object({
  startSwaps: z.int().nonnegative(),
  swapsPerNight: z.int().positive(),
  dayOffEvery: z.int().positive(),
  longMatchFrom: z.int().min(4),
  longMerge: z.object({
    building: z.int().nonnegative(),
    potion: z.object({
      raw: z.int().nonnegative(),
      bone: z.int().nonnegative(),
      obsidian: z.int().nonnegative(),
      crimson: z.int().nonnegative(),
    }),
  }),
  comboFrom: z.int().min(2),
  costs: z.object({
    swap: z.int().nonnegative(),
    drop: z.int().nonnegative(),
    open: z.int().nonnegative(),
    item: z.int().nonnegative(),
    nest: z.int().nonnegative(),
  }),
  potions: z.object({
    raw: PotionSchema,
    bone: PotionSchema,
    obsidian: PotionSchema,
    crimson: PotionSchema,
  }),
  rewardedSwaps: z.int().nonnegative(),
});

export const ECONOMY_CONFIG = EconomyConfigSchema.parse(BALANCE.economy);

/** Сколько крови в потире каждой ступени — в том виде, в каком его ждёт ход. */
export const POTION_SWAPS = {
  raw: ECONOMY_CONFIG.potions.raw.swaps,
  bone: ECONOMY_CONFIG.potions.bone.swaps,
  obsidian: ECONOMY_CONFIG.potions.obsidian.swaps,
  crimson: ECONOMY_CONFIG.potions.crimson.swaps,
};
