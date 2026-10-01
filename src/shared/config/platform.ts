import { z } from 'zod';

import raw from './platform.json';

/**
 * Настройки площадки. Это не цифры баланса из спеки, а имена и размеры,
 * которые задаём мы сами при публикации:
 *
 *   • `topCount` — сколько строк показываем в летописи;
 *   • `rewardedPlacement` — метка места показа ролика (ремонт цитадели),
 *     уходит в статистику рекламы.
 *
 * Имя таблицы рекордов сюда не входит: летопись у каждой цитадели своя (§12),
 * и оно лежит в `levels.json` вместе с остальными её параметрами. Как
 * настроить доски в кабинете Яндекса — `LEADERBOARDS.md` в корне проекта.
 */
const PlatformConfigSchema = z.object({
  topCount: z.int().positive(),
  rewardedPlacement: z.string().min(1),
});

export const PLATFORM_CONFIG = PlatformConfigSchema.parse(raw);
