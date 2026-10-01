import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Справочник врагов — раздел `enemies` из `balance.ts`.
 *
 * §10 говорит про обычных охотников ровно одно: «Типы, здоровье, скорость, урон
 * цитадели ❓». Все цифры выдуманы и помечены `verified: false` (§14 #8).
 */
const EnemySpecSchema = z.object({
  // Может быть отрицательным: у босса жизни растут с ночи, и «нулевая» ночь —
  // только точка отсчёта формулы.
  hp: z.number(),
  hpPerNight: z.number().nonnegative(),
  lateFromNight: z.int().nonnegative().optional(),
  lateHpBonus: z.number().nonnegative().optional(),
  /** Клеток в секунду. */
  speed: z.number().nonnegative(),
  speedGrowthPerNight: z.number().nonnegative(),
  lateSpeedFactor: z.number().positive().optional(),
  knockback: z.number().nonnegative().optional(),
  citadelDamage: z.number().nonnegative(),
  verified: z.boolean(),
});

const EnemyBookSchema = z.record(z.string(), EnemySpecSchema);

export const ENEMY_BOOK = EnemyBookSchema.parse(BALANCE.enemies);
