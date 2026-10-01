import { z } from 'zod';

import { BALANCE } from './balance';
import { BOSS_CONFIG } from './bosses';
import { ENEMY_BOOK } from './enemies';

/**
 * План обычной волны — раздел `waves` из `balance.ts`. Рост волн спека не
 * задаёт (§14 #9); формула и цифры сняты с оригинала.
 */
const WavePlanSchema = z.object({
  kind: z.string().min(1),
  perNight: z.number().nonnegative(),
  base: z.int().nonnegative(),
  spreadEveryNights: z.number().positive(),
  late: z
    .object({
      fromNight: z.int().nonnegative(),
      kind: z.string().min(1),
      factor: z.number().nonnegative(),
      minus: z.int().nonnegative(),
      perNight: z.int().nonnegative(),
      spreadFactor: z.number().positive(),
    })
    .optional(),
});

/** Скорость снарядов в бою. */
export const BATTLE_CONFIG = z
  .object({
    projectileSpeed: z.number().positive(),
    spawnDepth: z.int().nonnegative(),
    shootDepth: z.int().nonnegative(),
  })
  .parse(BALANCE.battle);

export const WAVE_PLAN = WavePlanSchema.parse(BALANCE.waves);

/**
 * Всё, что нужно, чтобы собрать волну любой ночи: обычный план, босс и шаг
 * между шеренгами — время, за которое обычный враг проходит клетку.
 */
export const NIGHT_WAVE_PLAN = (() => {
  const soldier = ENEMY_BOOK[WAVE_PLAN.kind];
  if (soldier === undefined) {
    throw new Error(`Вид «${WAVE_PLAN.kind}» из balance.ts → waves не описан в enemies`);
  }
  const late = WAVE_PLAN.late?.kind;
  if (late !== undefined && ENEMY_BOOK[late] === undefined) {
    throw new Error(`Вид «${late}» из balance.ts → waves.late не описан в enemies`);
  }
  return {
    regular: WAVE_PLAN,
    boss: BOSS_CONFIG,
    secondsPerCell: 1 / soldier.speed,
    speedGrowthPerNight: soldier.speedGrowthPerNight,
  };
})();
