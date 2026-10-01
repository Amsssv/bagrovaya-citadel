import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Очки (§14 #10) — раздел `score` из `balance.ts`. Веса выдуманы: спека не
 * говорит ни за что начисляют, ни сколько (`verified: false`).
 *
 * `checks` — то немногое, что §13 всё-таки даёт: потолок сильного игрока около
 * 5000 и разброс с новичком примерно в двадцать пять раз. Это не веса, а мера,
 * по которой бот проверяет, похожи ли подобранные цифры на оригинал.
 */
const ScoreConfigSchema = z.object({
  verified: z.boolean(),
  weights: z.object({
    night: z.number().nonnegative(),
    kill: z.number().nonnegative(),
    merge: z.number().nonnegative(),
    crimsonMerge: z.number().nonnegative(),
    potion: z.number().nonnegative(),
    boss: z.number().nonnegative(),
    /** За каждую постройку на поле в последнюю ночь — по ступени. */
    building: z.object({
      raw: z.number().nonnegative(),
      bone: z.number().nonnegative(),
      obsidian: z.number().nonnegative(),
      crimson: z.number().nonnegative(),
    }),
  }),
  checks: z.object({
    strongPlayerCeiling: z.number().positive(),
    spreadAgainstNovice: z.number().positive(),
  }),
});

export const SCORE_CONFIG = ScoreConfigSchema.parse(BALANCE.score);
