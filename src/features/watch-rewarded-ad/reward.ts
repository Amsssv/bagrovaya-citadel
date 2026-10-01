import type { PlatformAdapter } from '@/shared/api';

/**
 * Показ ролика за награду.
 *
 * Ролик — по желанию игрока и за награду. Полноэкранная реклама идёт
 * отдельно, перед новым забегом (`app/App.tsx`, как в matching-game).
 *
 * Геймплей start/stop здесь не шлётся: площадка ждёт парных событий, и их
 * выводит из одного условия тот, кто показывает ролик (`runAd` в
 * `app/App.tsx` ставит игру на паузу). Свой `gameplayStart` в конце показа
 * сообщил бы «игра идёт» и на экране итога забега, где её нет.
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

  return (await platform.showRewarded(placement)) === 'rewarded';
}

/** Сколько свапов заработано. Ноль — награды нет. */
export async function watchForSwaps(request: RewardRequest): Promise<number> {
  const { platform, placement, swaps } = request;
  return (await watchRewarded(platform, placement)) ? swaps : 0;
}
