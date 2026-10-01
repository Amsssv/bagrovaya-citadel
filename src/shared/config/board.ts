import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Поле и правила хода — раздел `board` из `balance.ts`.
 *
 * Подтверждено спекой: width/height (§2 + арт), resources (§5).
 * Решения владельца игры: cascadesEnabled (тройка от досыпки схлопывается сама;
 * §14 #6 открыт только в части награды).
 * Наше допущение: startWithoutMatches — спека молчит, пересдаём ли раздачу без
 * готовых троек. Реестр — docs/unknowns.md.
 */
const BoardConfigSchema = z.object({
  width: z.int().positive(),
  height: z.int().positive(),
  resources: z.array(z.enum(['stone', 'thorn', 'ash', 'fog', 'blood'])).nonempty(),
  startWithoutMatches: z.boolean(),
  cascadesEnabled: z.boolean(),
});

export type BoardConfig = z.infer<typeof BoardConfigSchema>;

// Проверяем всегда, а не только в dev: конфиг крошечный, а поднятый на старте
// битый баланс дешевле сломанного боя на двадцатой ночи.
export const BOARD_CONFIG: BoardConfig = BoardConfigSchema.parse(BALANCE.board);
