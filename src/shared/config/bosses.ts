import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Проповедник (§10) — раздел `bosses` из `balance.ts`.
 *
 * Подтверждено спекой: приходит на 10, 20, 30, 40 и 50 ночь; проповедников
 * четверо, каждый следующий сильнее; после смерти выходит паства, и не только
 * в его столбце.
 *
 * Выдумано (`verified: false`):
 *   flockSize          — §14 #13, спека даёт только «к пятому больше тридцати»;
 *   flockDelaySeconds  — через сколько выходит, не сказано вовсе;
 *   flockSpread        — «в соседних» понято как ±1 столбец;
 *   flockKind          — паства из обычных солдат: других видов пока нет.
 */
const PreacherSchema = z.object({
  kind: z.string().min(1),
  flockKind: z.string().min(1),
  flockSize: z.int().nonnegative(),
  flockDelaySeconds: z.number().nonnegative(),
  flockSpread: z.int().nonnegative(),
});

const BossConfigSchema = z.object({
  nights: z.array(z.int().positive()).nonempty(),
  preachers: z.array(PreacherSchema).nonempty(),
  verified: z.boolean(),
});

export const BOSS_CONFIG = BossConfigSchema.parse(BALANCE.bosses);
