import type { FullscreenResult } from '@/shared/api';

/**
 * Полноэкранная реклама — не чаще раза в 3 минуты игры. Время идёт, только
 * пока игра на экране и не на паузе. Платформа сверху держит свой лимит
 * частоты: слишком ранний вызов она просто не показывает.
 */
export const FULLSCREEN_EVERY_S = 180;

/**
 * Не показалась (лимит площадки, нет рекламы, блокировщик, ошибка) — следующая
 * попытка через минуту игры, а не на каждом рассвете: рассвет ждёт ответа
 * рекламы, и у игрока без показов каждая ночь начиналась бы с задержки.
 */
export const FULLSCREEN_RETRY_S = 60;

/** Пора ли пробовать показ. */
export function isFullscreenDue(playSeconds: number): boolean {
  return playSeconds >= FULLSCREEN_EVERY_S;
}

/** Сколько секунд игры считать после попытки показа. */
export function playSecondsAfterFullscreen(result: FullscreenResult): number {
  return result === 'shown' ? 0 : FULLSCREEN_EVERY_S - FULLSCREEN_RETRY_S;
}
