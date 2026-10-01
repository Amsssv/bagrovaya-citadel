import { describe, expect, it } from 'vitest';

import { createMockPlatform } from '@/shared/api';

import { watchForSwaps } from './reward';

describe('ролик за награду', () => {
  it('досмотренный ролик даёт свапы', async () => {
    const platform = createMockPlatform();
    expect(await watchForSwaps({ platform, placement: 'swaps', swaps: 5 })).toBe(5);
  });

  it('геймплеем не управляет: паузу на время ролика ставит тот, кто его показал', async () => {
    // Площадка ждёт парных start/stop; свой start в конце показа пришёл бы и
    // на экран итога забега, где игры нет.
    const platform = createMockPlatform();
    await watchForSwaps({ platform, placement: 'swaps', swaps: 5 });
    expect(platform.calls).toEqual(['showRewarded:swaps']);
  });

  it('закрытый ролик награды не даёт', async () => {
    const platform = createMockPlatform({ rewarded: 'closed' });
    expect(await watchForSwaps({ platform, placement: 'swaps', swaps: 5 })).toBe(0);
  });

  it('рекламы нет — ролик даже не запрашиваем', async () => {
    const platform = createMockPlatform({ rewarded: 'error' });
    expect(await watchForSwaps({ platform, placement: 'swaps', swaps: 5 })).toBe(0);
    expect(platform.calls).toEqual([]);
  });
});
