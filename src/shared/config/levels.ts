import { z } from 'zod';

import { BALANCE } from './balance';
import raw from './levels.json';

/**
 * Цитадели-уровни (§12). Не путать с `citadel.ts` — там замок: сердца, стена,
 * гнёзда.
 *
 * Уровень собирается из двух мест: имя, подсказка и летопись — здесь, в
 * `levels.json`; то, что влияет на игру (набор ресурсов и стартовый запас
 * крови), — в разделе `citadels` файла `balance.ts`. У каждой цитадели из
 * `levels.json` обязана быть запись в балансе — иначе запуск падает сразу.
 *
 * §12 говорит, что каждая цитадель отличается от Багровой **двумя
 * параметрами**, и в первую версию идут три: Багровая, Голодная ночь, Крипта
 * Праха.
 *
 * `leaderboard` — своя летопись у каждой цитадели: §12 отдельно отмечает, что
 * рекорды набирают в Крипте Праха, то есть между собой цитадели не сравнивают.
 */
const LevelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hint: z.string().min(1),
  leaderboard: z.string().min(1),
});

const LevelBalanceSchema = z.object({
  resources: z.array(z.enum(['stone', 'thorn', 'ash', 'fog', 'blood'])).nonempty(),
  startSwaps: z.int().nonnegative(),
});

const CitadelsBalanceSchema = z.record(z.string(), LevelBalanceSchema);

const LevelsConfigSchema = z.object({
  verified: z.boolean(),
  levels: z.array(LevelSchema).nonempty(),
});

export const LEVELS_CONFIG = LevelsConfigSchema.parse(raw);

const CITADELS_BALANCE = CitadelsBalanceSchema.parse(BALANCE.citadels);

export const LEVELS = LEVELS_CONFIG.levels.map((level) => {
  const balance = CITADELS_BALANCE[level.id];
  if (balance === undefined) {
    throw new Error(`У цитадели «${level.id}» нет записи в balance.ts → citadels`);
  }
  return { ...level, ...balance };
});
