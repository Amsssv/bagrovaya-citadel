// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStorage, createMockPlatform } from '@/shared/api';

import { LANG_STORAGE_KEY, detectLang, saveLangChoice } from './lang';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('язык при запуске', () => {
  it('берётся из SDK', async () => {
    const platform = createMockPlatform({ lang: 'en' });
    expect(await detectLang(platform, createMemoryStorage())).toBe('en');
  });

  it('язык СНГ от площадки — русский', async () => {
    const platform = createMockPlatform({ lang: 'kk' });
    expect(await detectLang(platform, createMemoryStorage())).toBe('ru');
  });

  it('ручной выбор игрока сильнее площадки', async () => {
    const storage = createMemoryStorage();
    saveLangChoice('ru', storage);
    expect(storage.read(LANG_STORAGE_KEY)).toBe('ru');
    const platform = createMockPlatform({ lang: 'en' });
    expect(await detectLang(platform, storage)).toBe('ru');
  });

  it('мусор в хранилище не мешает — идём к площадке', async () => {
    const storage = createMemoryStorage();
    storage.write(LANG_STORAGE_KEY, 'klingon');
    expect(await detectLang(createMockPlatform({ lang: 'en' }), storage)).toBe('en');
  });

  it('?lang= в адресе сильнее всего', async () => {
    window.history.replaceState(null, '', '/?lang=en');
    const storage = createMemoryStorage();
    saveLangChoice('ru', storage);
    expect(await detectLang(createMockPlatform({ lang: 'ru' }), storage)).toBe('en');
  });

  it('площадка всё равно поднимается', async () => {
    const platform = createMockPlatform({ lang: 'en' });
    const init = vi.spyOn(platform, 'init');
    const storage = createMemoryStorage();
    saveLangChoice('ru', storage);
    await detectLang(platform, storage);
    expect(init).toHaveBeenCalled();
  });
});
