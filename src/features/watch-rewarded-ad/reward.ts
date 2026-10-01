import type { PlatformAdapter } from '@/shared/api';

/**
 * Показ ролика за награду.
 *
 * Ролик — по желанию игрока и за награду. Полноэкранная реклама идёт
 * отдельно, перед новым забегом (`app/App.tsx`, как в matching-game).
 *
 * На время ролика геймплей останавливается: площадка ждёт парных событий
 * start/stop, а звук и таймеры не должны идти под рекламой. Возврат
 * геймплея — в `finally`: иначе сорвавшийся показ оставил бы игру в
 * остановленном состоянии навсегда.
 *
 * Сколько свапов даёт ролик, спека не говорит — цифра приходит снаружи.
 */
export interface RewardRequest {
  readonly platform: PlatformAdapter;
  readonly placement: string;
  readonly swaps: number;
}

/** Досмотрел ли игрок ролик — награду за него решает вызывающий. */
export async function watchRewarded(
  platform: PlatformAdapter,
  placement: string,
): Promise<boolean> {
  // Рекламы нет — кнопки быть не должно, но проверяем и здесь: блокировщик
  // мог появиться между отрисовкой и нажатием.
  if (!platform.isRewardedAvailable()) return false;

  platform.gameplayStop();
  try {
    return (await platform.showRewarded(placement)) === 'rewarded';
  } finally {
    platform.gameplayStart();
  }
}

/** Сколько свапов заработано. Ноль — награды нет. */
export async function watchForSwaps(request: RewardRequest): Promise<number> {
  const { platform, placement, swaps } = request;
  return (await watchRewarded(platform, placement)) ? swaps : 0;
}
