import { describe, expect, it } from 'vitest';

import { createMockPlatform } from '@/shared/api';

import { watchForSwaps } from './reward';

describe('ролик за награду', () => {
  it('досмотренный ролик даёт свапы', async () => {
    const platform = createMockPlatform();
    expect(await watchForSwaps({ platform, placement: 'swaps', swaps: 5 })).toBe(5);
  });

  it('на время ролика геймплей останавливается и возобновляется после', async () => {
    // Площадка ждёт парных событий, а звук и таймеры не должны идти под рекламой.
    const platform = createMockPlatform();
    await watchForSwaps({ platform, placement: 'swaps', swaps: 5 });
    expect(platform.calls).toEqual(['gameplayStop', 'showRewarded:swaps', 'gameplayStart']);
  });

  it('закрытый ролик награды не даёт, но геймплей возвращает', async () => {
    const platform = createMockPlatform({ rewarded: 'closed' });
    expect(await watchForSwaps({ platform, placement: 'swaps', swaps: 5 })).toBe(0);
    expect(platform.calls).toContain('gameplayStart');
  });

  it('рекламы нет — ролик даже не запрашиваем', async () => {
    const platform = createMockPlatform({ rewarded: 'error' });
    expect(await watchForSwaps({ platform, placement: 'swaps', swaps: 5 })).toBe(0);
    expect(platform.calls).toEqual([]);
  });
});
