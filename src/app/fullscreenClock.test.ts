import { describe, expect, it } from 'vitest';

import {
  FULLSCREEN_EVERY_S,
  FULLSCREEN_RETRY_S,
  isFullscreenDue,
  playSecondsAfterFullscreen,
} from './fullscreenClock';

/** Секунды игры до следующей попытки показа после такого исхода. */
function secondsToNextTry(result: Parameters<typeof playSecondsAfterFullscreen>[0]): number {
  let seconds = playSecondsAfterFullscreen(result);
  let waited = 0;
  while (!isFullscreenDue(seconds)) {
    seconds += 1;
    waited += 1;
  }
  return waited;
}

describe('отсчёт полноэкранной рекламы', () => {
  it('до трёх минут игры показа нет', () => {
    expect(isFullscreenDue(FULLSCREEN_EVERY_S - 1)).toBe(false);
    expect(isFullscreenDue(FULLSCREEN_EVERY_S)).toBe(true);
  });

  it('показалась — следующая через три минуты', () => {
    expect(secondsToNextTry('shown')).toBe(FULLSCREEN_EVERY_S);
  });

  // Регресс: «враг не нападает на рассвете». Неудачный показ не сбрасывал
  // отсчёт, и у игрока без рекламы попытка — и ожидание перед атакой — шли на
  // каждом рассвете.
  it.each(['skipped', 'error'] as const)(
    'не показалась (%s) — повтор через минуту, а не на следующем рассвете',
    (result) => {
      expect(secondsToNextTry(result)).toBe(FULLSCREEN_RETRY_S);
      expect(FULLSCREEN_RETRY_S).toBeGreaterThan(0);
    },
  );
});
