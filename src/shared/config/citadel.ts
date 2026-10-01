import { z } from 'zod';

import { BALANCE } from './balance';

/**
 * Замок: сердца, стена, гнёзда — раздел `citadel` из `balance.ts`. Не путать с
 * цитаделями-уровнями (`levels.ts`).
 *
 * Открытые вопросы к спеке (docs/unknowns.md):
 *   startHearts          — спека называет только потолок, старт не назван;
 *   wallInIsAutomatic    — §9: камень из верхнего ряда замуровывается сам или
 *                          только когда игрок затолкал его наверх свапом;
 *   heartsPerWalledStone — «+сердце» читается как одно, но прямо не сказано;
 *   nests                — башни замка оригинала: две, над крайними столбцами,
 *                          только горгулья, радиус 2 (снято с оригинала).
 *
 * Подтверждено спекой: maxHearts = 30 (§9, со слов игроков).
 */
const NestSlotSchema = z.object({
  id: z.string().min(1),
  /** Клетка поля, из которой постройку толкают в гнездо. */
  from: z.object({ x: z.int().nonnegative(), y: z.int().nonnegative() }),
  direction: z.enum(['up', 'down', 'left', 'right']),
  accepts: z.array(z.enum(['gargoyle', 'vine', 'mortar', 'fogveil'])).optional(),
});

const CitadelConfigSchema = z.object({
  startHearts: z.int().positive(),
  maxHearts: z.int().positive(),
  heartsPerWalledStone: z.int().positive(),
  wallInIsAutomatic: z.boolean(),
  nests: z.array(NestSlotSchema),
  /** Радиус огня из гнезда. */
  turretRange: z.int().positive(),
});

export type CitadelConfig = z.infer<typeof CitadelConfigSchema>;

export const CITADEL_CONFIG: CitadelConfig = CitadelConfigSchema.parse(BALANCE.citadel);
