import { describe, expect, it } from 'vitest';

import { createAbsentPlatform, createMockPlatform } from './mockPlatform';
import type { PlatformAdapter } from './platform';

const PRODUCTS = [{ id: 'pack_small', title: 'Малый', description: 'кошелёк', price: '59 YAN' }];

describe('мок площадки', () => {
  it('поднимается и сообщает о готовности', async () => {
    const platform = createMockPlatform();
    expect(platform.isReady()).toBe(false);
    await platform.init();
    expect(platform.isReady()).toBe(true);
  });

  it('облачный сейв записывается и читается', async () => {
    const platform = createMockPlatform();
    await platform.saveData({ night: 7 });
    expect(await platform.loadData()).toEqual({ night: 7 });
  });

  it('гость становится авторизованным после запроса', async () => {
    const platform = createMockPlatform();
    expect(platform.getPlayerMode()).toBe('guest');
    expect(await platform.requestAuth()).toBe(true);
    expect(platform.getPlayerMode()).toBe('authorized');
  });

  it('покупка неизвестного товара недоступна, известного — проходит', async () => {
    const platform = createMockPlatform({ products: PRODUCTS });
    expect(await platform.purchase('нет-такого')).toEqual({ status: 'unavailable' });

    const bought = await platform.purchase('pack_small');
    expect(bought.status).toBe('bought');
    expect(await platform.getUnprocessedPurchases()).toHaveLength(1);
  });

  it('списанная покупка больше не висит необработанной', async () => {
    const platform = createMockPlatform({ products: PRODUCTS });
    const bought = await platform.purchase('pack_small');
    if (bought.status !== 'bought') throw new Error('покупка не прошла');

    await platform.consume(bought.purchase.token);
    expect(await platform.getUnprocessedPurchases()).toEqual([]);
  });

  it('таблица рекордов отдаёт не больше запрошенного', async () => {
    const platform = createMockPlatform({
      leaderboards: {
        best: [
          { rank: 1, name: 'Мортен', score: 900, isPlayer: false },
          { rank: 2, name: 'Ты', score: 500, isPlayer: true },
        ],
      },
    });
    expect(await platform.getLeaderboard('best', 1)).toHaveLength(1);
    expect(await platform.getLeaderboard('нет-такой', 10)).toEqual([]);
  });

  it('серверное время можно объявить недоверенным', async () => {
    const trusted = await createMockPlatform({ now: () => 5 }).getServerTime();
    expect(trusted).toEqual({ ms: 5, trusted: true });

    const local = await createMockPlatform({ serverTimeTrusted: false }).getServerTime();
    expect(local.trusted).toBe(false);
  });

  it('реклама может притвориться сломанной', async () => {
    const broken = createMockPlatform({ rewarded: 'error' });
    expect(broken.isRewardedAvailable()).toBe(false);
    expect(await broken.showRewarded('дополнительный ход')).toBe('error');
  });

  it('закрытый без просмотра ролик награды не даёт', async () => {
    expect(await createMockPlatform({ rewarded: 'closed' }).showRewarded('где-то')).toBe('closed');
  });

  it('записывает, что у неё просили', async () => {
    const platform = createMockPlatform();
    platform.gameReady();
    platform.gameplayStart();
    platform.gameplayStop();
    await platform.submitScore('best', 120);
    expect(platform.calls).toEqual([
      'gameReady',
      'gameplayStart',
      'gameplayStop',
      'submitScore:best:120',
    ]);
  });

  it('без настроек ролик всегда награждает, товаров нет, язык русский', async () => {
    const platform = createMockPlatform();
    expect(platform.isRewardedAvailable()).toBe(true);
    expect(await platform.showRewarded('ещё свапов')).toBe('rewarded');
    expect(await platform.purchase('pack_small')).toEqual({ status: 'unavailable' });
    expect(platform.getLang()).toBe('ru');
  });

  it('игрок может быть заранее авторизованным', () => {
    expect(createMockPlatform({ mode: 'authorized' }).getPlayerMode()).toBe('authorized');
  });

  it('каталог отдаёт настроенные товары', async () => {
    expect(await createMockPlatform({ products: PRODUCTS }).getProducts()).toEqual(PRODUCTS);
    expect(await createMockPlatform().getProducts()).toEqual([]);
  });

  it('списание неизвестного токена ничего не ломает', async () => {
    const platform = createMockPlatform({ products: PRODUCTS });
    await platform.purchase('pack_small');
    await platform.consume('чужой-токен');
    expect(await platform.getUnprocessedPurchases()).toHaveLength(1);
  });

  it('облако видно тесту снаружи', async () => {
    const platform = createMockPlatform();
    expect(platform.cloud).toBeNull();
    await platform.saveData({ night: 2 });
    expect(platform.cloud).toEqual({ night: 2 });
  });

  it('худший результат не затирает лучший', async () => {
    const platform = createMockPlatform();
    await platform.submitScore('best', 500);
    await platform.submitScore('best', 100);
    await platform.submitScore('best', 900);
    expect(platform.calls).toEqual([
      'submitScore:best:500',
      'submitScore:best:100',
      'submitScore:best:900',
    ]);
  });

  it('флаги и язык отдаются как настроено', async () => {
    const platform = createMockPlatform({ flags: { shop: 'off' }, lang: 'en' });
    expect(await platform.getFlags()).toEqual({ shop: 'off' });
    expect(platform.getLang()).toBe('en');
  });
});

describe('площадки нет вовсе — игра обязана работать', () => {
  const absent: PlatformAdapter = createAbsentPlatform();

  it('ни один вызов не бросает', async () => {
    await expect(absent.init()).resolves.toBeUndefined();
    await expect(absent.saveData({ a: 1 })).resolves.toBeUndefined();
    await expect(absent.consume('токен')).resolves.toBeUndefined();
    await expect(absent.submitScore('best', 10)).resolves.toBeUndefined();
    expect(() => {
      absent.gameReady();
      absent.gameplayStart();
      absent.gameplayStop();
    }).not.toThrow();
  });

  it('сейв не читается — значит, играем с местного', async () => {
    expect(await absent.loadData()).toBeNull();
  });

  it('реклама гасит кнопку, а не ломает ход', async () => {
    expect(absent.isRewardedAvailable()).toBe(false);
    expect(await absent.showRewarded('где-то')).toBe('error');
  });

  it('магазин пуст, покупка недоступна', async () => {
    expect(await absent.getProducts()).toEqual([]);
    expect(await absent.purchase('pack_small')).toEqual({ status: 'unavailable' });
    expect(await absent.getUnprocessedPurchases()).toEqual([]);
  });

  it('таблица пуста — покажем местный рекорд', async () => {
    expect(await absent.getLeaderboard('best', 10)).toEqual([]);
  });

  it('время местное и недоверенное', async () => {
    expect((await absent.getServerTime()).trusted).toBe(false);
  });

  it('игрок — гость, и авторизоваться негде', async () => {
    expect(absent.getPlayerMode()).toBe('guest');
    expect(await absent.requestAuth()).toBe(false);
  });

  it('флаги пусты, язык по умолчанию', async () => {
    expect(await absent.getFlags()).toEqual({});
    expect(absent.getLang()).toBe('ru');
    expect(absent.isReady()).toBe(false);
  });
});

describe('реклама и паузы в площадке для разработки', () => {
  it('полноэкранная показывается, паузы раздаются подписчикам', async () => {
    const platform = createMockPlatform({ fullscreen: 'skipped' });
    expect(await platform.showFullscreen()).toBe('skipped');
    expect(await createMockPlatform().showFullscreen()).toBe('shown');
    const seen: boolean[] = [];
    const off = platform.onPause((paused) => seen.push(paused));
    platform.emitPause(true);
    off();
    platform.emitPause(false);
    expect(seen).toEqual([true]);
  });

  it('площадки нет — рекламы нет, пауз нет', async () => {
    const absent = createAbsentPlatform();
    expect(await absent.showFullscreen()).toBe('error');
    expect(() => {
      absent.onPause(() => undefined)();
    }).not.toThrow();
  });
});
