import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlatform } from './createPlatform';

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Выбор площадки — единственное место, где игра вообще смотрит на `window`.
 * Проверяем по наблюдаемому признаку: готовой после `init` может стать только
 * настоящая площадка, «площадки нет» остаётся неготовой всегда.
 */
describe('выбор площадки', () => {
  it('Яндекс в окне — берём его', async () => {
    const sdk = { environment: { i18n: { lang: 'en' } } } as unknown as YandexGamesSDK;
    vi.stubGlobal('window', { YaGames: { init: () => Promise.resolve(sdk) } });

    const platform = createPlatform();
    await platform.init();
    expect(platform.isReady()).toBe(true);
    expect(platform.getLang()).toBe('en');
  });

  it('скрипт SDK не подгрузился — играем без площадки', async () => {
    vi.stubGlobal('window', {});

    const platform = createPlatform();
    await platform.init();
    expect(platform.isReady()).toBe(false);
  });

  it('окна нет вовсе — бот и тесты запускаются без площадки', async () => {
    const platform = createPlatform();
    await platform.init();
    expect(platform.isReady()).toBe(false);
    expect(platform.isRewardedAvailable()).toBe(false);
  });
});
