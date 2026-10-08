import { afterEach, describe, expect, it, vi } from 'vitest';

import { createYandexPlatform } from './adapter';

type AdvCallbacks = {
  onOpen?: () => void;
  onRewarded(): void;
  onClose?: () => void;
  onError?: (e: unknown) => void;
};

type FullscreenCallbacks = {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (e: unknown) => void;
  onOffline?: () => void;
};

interface ScoreRecord {
  readonly board: string;
  readonly score: number;
  readonly at: number;
}

/**
 * Поддельная площадка. Всё, что может отказать у настоящей, отказывает и здесь:
 * `throwOn` роняет любой вызов по имени, поля состояния меняются на ходу.
 */
function createFake() {
  const calls: string[] = [];
  const scores: ScoreRecord[] = [];
  const throwOn = new Set<string>();
  const state = {
    authorized: true,
    name: 'Мортен',
    data: { save: { night: 3 } } as Record<string, unknown>,
    auth: 'login' as 'close' | 'login',
    serverTime: 1_700_000_000_000,
    entry: { score: 100, rank: 1, player: { publicName: 'Мортен' } } as YandexLeaderboardEntry,
    entryFails: false,
    entries: [] as YandexLeaderboardEntry[],
  };

  const fail = (key: string): void => {
    if (throwOn.has(key)) throw new Error(key);
  };

  let callbacks: AdvCallbacks | null = null;

  const player: YandexPlayer = {
    isAuthorized: () => {
      fail('isAuthorized');
      return state.authorized;
    },
    getName: () => state.name,
    getData: async (keys) => {
      fail('getData');
      calls.push(`getData:${String(keys)}`);
      return Promise.resolve(state.data);
    },
    setData: async (data, flush) => {
      fail('setData');
      calls.push(`setData:${String(flush)}`);
      state.data = { ...data };
      return Promise.resolve();
    },
  };

  const payments: YandexPayments = {
    purchase: async ({ id }) => {
      fail('purchase');
      return Promise.resolve({ productID: id, purchaseToken: `token-${id}` });
    },
    getPurchases: async () => {
      fail('getPurchases');
      return Promise.resolve([{ productID: 'pack', purchaseToken: 'token-pack' }]);
    },
    consumePurchase: async (token) => {
      fail('consumePurchase');
      calls.push(`consume:${token}`);
      return Promise.resolve();
    },
    getCatalog: async () => {
      fail('getCatalog');
      return Promise.resolve([
        { id: 'pack', title: 'Кошель', description: 'слёзы', price: '59 YAN' },
      ]);
    },
  };

  const events = new Map<YandexGameEvent, () => void>();
  let fullscreen: FullscreenCallbacks | null = null;
  const sdk: YandexGamesSDK = {
    on: (event, callback) => {
      events.set(event, callback);
    },
    off: () => undefined,
    environment: { i18n: { lang: 'ru' } },
    features: {
      LoadingAPI: {
        ready: () => {
          fail('ready');
          calls.push('ready');
        },
      },
      GameplayAPI: {
        start: () => {
          fail('start');
          calls.push('start');
        },
        stop: () => {
          fail('stop');
          calls.push('stop');
        },
      },
    },
    auth: {
      openAuthDialog: async () => {
        fail('openAuthDialog');
        return Promise.resolve({ action: state.auth });
      },
    },
    adv: {
      showRewardedVideo: (opts) => {
        fail('showRewardedVideo');
        calls.push('showRewardedVideo');
        callbacks = opts.callbacks;
      },
      showFullscreenAdv: (opts) => {
        fail('showFullscreenAdv');
        calls.push('showFullscreenAdv');
        fullscreen = opts.callbacks;
      },
    },
    serverTime: () => {
      fail('serverTime');
      return state.serverTime;
    },
    getFlags: async () => {
      fail('getFlags');
      return Promise.resolve({ shop: 'on' });
    },
    getPlayer: async () => {
      fail('getPlayer');
      return Promise.resolve(player);
    },
    getPayments: async () => {
      fail('getPayments');
      return Promise.resolve(payments);
    },
    leaderboards: {
      setScore: async (board, score) => {
        fail('setScore');
        scores.push({ board, score, at: Date.now() });
        return Promise.resolve();
      },
      getPlayerEntry: async () => {
        if (state.entryFails) throw new Error('записи ещё нет');
        return Promise.resolve(state.entry);
      },
      getEntries: async (_board, opts) => {
        fail('getEntries');
        calls.push(`includeUser:${String(opts?.includeUser)}`);
        return Promise.resolve({ entries: state.entries });
      },
    },
  };

  return {
    sdk,
    state,
    calls,
    scores,
    throwOn,
    /** Площадка присылает своё событие. */
    emit: (event: YandexGameEvent): void => {
      events.get(event)?.();
    },
    /** Коллбэки последней полноэкранной рекламы. */
    fullscreen: (): FullscreenCallbacks => {
      if (fullscreen === null) throw new Error('полноэкранную не показывали');
      return fullscreen;
    },
    /** Коллбэки последнего показанного ролика. */
    ad: (): AdvCallbacks => {
      if (callbacks === null) throw new Error('ролик не показывали');
      return callbacks;
    },
  };
}

type Fake = ReturnType<typeof createFake>;

/** Площадка в окне: undefined — скрипт SDK не подгрузился. */
function install(sdk: YandexGamesSDK | undefined): void {
  vi.stubGlobal('window', {
    YaGames: sdk === undefined ? undefined : { init: () => Promise.resolve(sdk) },
  });
}

async function started(fake: Fake = createFake()) {
  install(fake.sdk);
  const platform = createYandexPlatform();
  await platform.init();
  return { platform, fake };
}

const gapsOf = (scores: readonly ScoreRecord[]): number[] =>
  scores.slice(1).map((record, index) => record.at - (scores[index] as ScoreRecord).at);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('подъём площадки', () => {
  it('поднимается и становится готова', async () => {
    const { platform } = await started();
    expect(platform.isReady()).toBe(true);
  });

  it('окна нет вовсе — не падаем, просто не готовы', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect(platform.isReady()).toBe(false);
  });

  it('скрипт SDK не подгрузился — не готовы', async () => {
    install(undefined);
    const platform = createYandexPlatform();
    await platform.init();
    expect(platform.isReady()).toBe(false);
  });

  it('init площадки упал — играем без неё', async () => {
    vi.stubGlobal('window', { YaGames: { init: () => Promise.reject(new Error('нет сети')) } });
    const platform = createYandexPlatform();
    await expect(platform.init()).resolves.toBeUndefined();
    expect(platform.isReady()).toBe(false);
  });

  it('повторный init не поднимает SDK заново', async () => {
    const fake = createFake();
    const init = vi.fn(() => Promise.resolve(fake.sdk));
    vi.stubGlobal('window', { YaGames: { init } });
    const platform = createYandexPlatform();
    await Promise.all([platform.init(), platform.init()]);
    await platform.init();
    expect(init).toHaveBeenCalledTimes(1);
    expect(platform.isReady()).toBe(true);
  });

  it('SDK есть, а игрок не отдался — остаёмся гостем', async () => {
    const fake = createFake();
    fake.throwOn.add('getPlayer');
    install(fake.sdk);
    const platform = createYandexPlatform();
    await platform.init();
    expect(platform.getPlayerMode()).toBe('guest');
  });
});

describe('сейв в облаке', () => {
  it('авторизованный читает и пишет', async () => {
    const { platform, fake } = await started();
    expect(await platform.loadData()).toEqual({ night: 3 });

    await platform.saveData({ night: 9 });
    expect(fake.state.data['save']).toEqual({ night: 9 });
    expect(fake.calls).toContain('setData:true');
  });

  it('гостю облако недоступно — ни чтения, ни записи', async () => {
    const fake = createFake();
    fake.state.authorized = false;
    const { platform } = await started(fake);

    expect(await platform.loadData()).toBeNull();
    await platform.saveData({ night: 9 });
    expect(fake.calls).not.toContain('setData:true');
  });

  it('в облаке пусто — значит, сейва нет', async () => {
    const fake = createFake();
    fake.state.data = {};
    const { platform } = await started(fake);
    expect(await platform.loadData()).toBeNull();
  });

  it('облако отказало — читаем местный сейв, а не падаем', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('getData');
    fake.throwOn.add('setData');

    expect(await platform.loadData()).toBeNull();
    await expect(platform.saveData({ night: 1 })).resolves.toBeUndefined();
  });

  it('площадки нет — облака тоже нет', async () => {
    install(undefined);
    const platform = createYandexPlatform();
    await platform.init();
    expect(await platform.loadData()).toBeNull();
    await expect(platform.saveData({ night: 1 })).resolves.toBeUndefined();
  });
});

describe('серверное время', () => {
  it('площадка ответила — время доверенное', async () => {
    const { platform, fake } = await started();
    expect(await platform.getServerTime()).toEqual({ ms: fake.state.serverTime, trusted: true });
  });

  it('метода нет — время местное и недоверенное', async () => {
    const fake = createFake();
    delete fake.sdk.serverTime;
    const { platform } = await started(fake);

    const time = await platform.getServerTime();
    expect(time.trusted).toBe(false);
    expect(time.ms).toBeGreaterThan(0);
  });

  it('метод бросил — недоверенное, но игра идёт', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('serverTime');
    expect((await platform.getServerTime()).trusted).toBe(false);
  });

  it('вернулась бессмыслица — недоверенное', async () => {
    const fake = createFake();
    fake.state.serverTime = Number.NaN;
    const { platform } = await started(fake);
    expect((await platform.getServerTime()).trusted).toBe(false);
  });

  it('площадки нет — недоверенное', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect((await platform.getServerTime()).trusted).toBe(false);
  });
});

describe('игрок', () => {
  it('авторизованный опознаётся', async () => {
    const { platform } = await started();
    expect(platform.getPlayerMode()).toBe('authorized');
  });

  it('вопрос об авторизации сам упал — считаем гостем', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('isAuthorized');
    expect(platform.getPlayerMode()).toBe('guest');
  });

  it('вход прошёл — игрок перечитывается', async () => {
    const fake = createFake();
    fake.state.authorized = false;
    const { platform } = await started(fake);

    fake.state.authorized = true;
    expect(await platform.requestAuth()).toBe(true);
    expect(platform.getPlayerMode()).toBe('authorized');
  });

  it('окно входа закрыли — остаёмся гостем', async () => {
    const fake = createFake();
    fake.state.auth = 'close';
    const { platform } = await started(fake);
    expect(await platform.requestAuth()).toBe(false);
  });

  it('вход упал — остаёмся гостем', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('openAuthDialog');
    expect(await platform.requestAuth()).toBe(false);
  });

  it('площадки нет — входить некуда', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect(await platform.requestAuth()).toBe(false);
  });
});

describe('ролик за награду', () => {
  it('награда засчитывается только после закрытия', async () => {
    const { platform, fake } = await started();
    const shown = platform.showRewarded('ещё свапов');

    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(await shown).toBe('rewarded');
  });

  it('пока ролик на экране, награда не отдаётся: игра ожила бы под рекламой', async () => {
    const { platform, fake } = await started();
    let settled = false;
    const shown = platform.showRewarded('ещё свапов').then((result) => {
      settled = true;
      return result;
    });

    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    fake.ad().onClose?.();
    expect(await shown).toBe('rewarded');
  });

  it('закрыл, не досмотрев — награды нет', async () => {
    const { platform, fake } = await started();
    const shown = platform.showRewarded('ещё свапов');
    fake.ad().onClose?.();
    expect(await shown).toBe('closed');
  });

  it('ошибка показа — не награда', async () => {
    const { platform, fake } = await started();
    const shown = platform.showRewarded('ещё свапов');
    fake.ad().onError?.(new Error('нет рекламы'));
    expect(await shown).toBe('error');
  });

  it('после ответа поздние коллбэки ничего не меняют', async () => {
    const { platform, fake } = await started();
    const shown = platform.showRewarded('ещё свапов');
    fake.ad().onError?.(new Error('нет рекламы'));
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(await shown).toBe('error');
  });

  it('сам вызов бросил — не награда', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('showRewardedVideo');
    expect(await platform.showRewarded('ещё свапов')).toBe('error');
  });

  it('площадка не позвала ни разу — через пятнадцать секунд отпускаем игрока', async () => {
    const { platform } = await started();
    vi.useFakeTimers();
    const shown = platform.showRewarded('ещё свапов');

    await vi.advanceTimersByTimeAsync(15_000);
    expect(await shown).toBe('error');
  });

  it('ролик открылся и завис — короткий сторож его не обрывает', async () => {
    const { platform, fake } = await started();
    vi.useFakeTimers();
    const shown = platform.showRewarded('ещё свапов');
    fake.ad().onOpen?.();

    await vi.advanceTimersByTimeAsync(60_000);
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(await shown).toBe('rewarded');
  });

  it('завис после награды — награду отдаём', async () => {
    const { platform, fake } = await started();
    vi.useFakeTimers();
    const shown = platform.showRewarded('ещё свапов');
    fake.ad().onOpen?.();
    fake.ad().onRewarded();

    await vi.advanceTimersByTimeAsync(180_000);
    expect(await shown).toBe('rewarded');
  });

  it('завис без награды — отпускаем с ошибкой', async () => {
    const { platform, fake } = await started();
    vi.useFakeTimers();
    const shown = platform.showRewarded('ещё свапов');
    fake.ad().onOpen?.();

    await vi.advanceTimersByTimeAsync(180_000);
    expect(await shown).toBe('error');
  });

  it('рекламы в SDK нет — кнопка гаснет', async () => {
    const fake = createFake();
    delete fake.sdk.adv;
    const { platform } = await started(fake);

    expect(platform.isRewardedAvailable()).toBe(false);
    expect(await platform.showRewarded('ещё свапов')).toBe('error');
  });

  it('площадки нет — кнопка гаснет', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect(platform.isRewardedAvailable()).toBe(false);
  });

  it('реклама есть — кнопку показываем', async () => {
    const { platform } = await started();
    expect(platform.isRewardedAvailable()).toBe(true);
  });
});

describe('покупки', () => {
  it('каталог переводится в наш вид', async () => {
    const { platform } = await started();
    expect(await platform.getProducts()).toEqual([
      { id: 'pack', title: 'Кошель', description: 'слёзы', price: '59 YAN' },
    ]);
  });

  it('каталог не отдался — магазина нет', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('getCatalog');
    expect(await platform.getProducts()).toEqual([]);
  });

  it('покупка проходит и возвращает токен', async () => {
    const { platform } = await started();
    expect(await platform.purchase('pack')).toEqual({
      status: 'bought',
      purchase: { productId: 'pack', token: 'token-pack' },
    });
  });

  it('окно оплаты закрыли — это не ошибка игры', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('purchase');
    expect(await platform.purchase('pack')).toEqual({ status: 'cancelled' });
  });

  it('платежей нет — покупка недоступна', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect(await platform.purchase('pack')).toEqual({ status: 'unavailable' });
    expect(await platform.getProducts()).toEqual([]);
    expect(await platform.getUnprocessedPurchases()).toEqual([]);
    await expect(platform.consume('token-pack')).resolves.toBeUndefined();
  });

  it('необработанные покупки переводятся в наш вид', async () => {
    const { platform } = await started();
    expect(await platform.getUnprocessedPurchases()).toEqual([
      { productId: 'pack', token: 'token-pack' },
    ]);
  });

  it('список покупок не отдался — считаем, что висящих нет', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('getPurchases');
    expect(await platform.getUnprocessedPurchases()).toEqual([]);
  });

  it('списание уходит площадке', async () => {
    const { platform, fake } = await started();
    await platform.consume('token-pack');
    expect(fake.calls).toContain('consume:token-pack');
  });

  it('списание не прошло — вернёмся к нему при следующем запуске', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('consumePurchase');
    await expect(platform.consume('token-pack')).resolves.toBeUndefined();
  });
});

describe('летопись рекордов', () => {
  it('первый результат уходит целиком', async () => {
    const fake = createFake();
    fake.state.entryFails = true;
    const { platform } = await started(fake);

    await platform.submitScore('best', 120);
    expect(fake.scores.map((record) => record.score)).toEqual([120]);
  });

  it('результат хуже прошлого не отправляется: площадка перезаписывает безусловно', async () => {
    const { platform, fake } = await started();
    await platform.submitScore('best', 50);
    expect(fake.scores).toEqual([]);
  });

  it('результат лучше прошлого отправляется', async () => {
    const { platform, fake } = await started();
    await platform.submitScore('best', 150);
    expect(fake.scores.map((record) => record.score)).toEqual([150]);
  });

  it('пустой результат не отправляется', async () => {
    const { platform, fake } = await started();
    await platform.submitScore('best', 0);
    await platform.submitScore('best', Number.NaN);
    expect(fake.scores).toEqual([]);
  });

  it('таблицы нет — отправлять некуда', async () => {
    const fake = createFake();
    delete fake.sdk.leaderboards;
    const { platform } = await started(fake);

    await expect(platform.submitScore('best', 120)).resolves.toBeUndefined();
    expect(await platform.getLeaderboard('best', 10)).toEqual([]);
  });

  it('запись отклонили — молчим, ход продолжается', async () => {
    const fake = createFake();
    fake.state.entryFails = true;
    fake.throwOn.add('setScore');
    const { platform } = await started(fake);

    await expect(platform.submitScore('best', 120)).resolves.toBeUndefined();
  });

  it('две записи подряд разводятся на секунду: чаще площадка молча отбрасывает', async () => {
    const fake = createFake();
    fake.state.entryFails = true;
    const { platform } = await started(fake);
    vi.useFakeTimers();

    const first = platform.submitScore('best', 10);
    const second = platform.submitScore('best', 20);
    await vi.advanceTimersByTimeAsync(5_000);
    await Promise.all([first, second]);

    expect(fake.scores.map((record) => record.score)).toEqual([10, 20]);
    expect(gapsOf(fake.scores)).toEqual([1000]);
  });

  it('своя строка узнаётся по месту, а не по имени', async () => {
    const fake = createFake();
    fake.state.entry = { score: 500, rank: 2, player: { publicName: 'Мортен' } };
    fake.state.entries = [
      { score: 900, rank: 1, player: { publicName: 'Мортен' } },
      { score: 500, rank: 2, player: { publicName: 'Мортен' } },
      { score: 100, rank: 3, player: { publicName: '' } },
    ];
    const { platform } = await started(fake);

    expect(await platform.getLeaderboard('best', 3)).toEqual([
      { rank: 1, name: 'Мортен', score: 900, isPlayer: false },
      { rank: 2, name: 'Мортен', score: 500, isPlayer: true },
      { rank: 3, name: '—', score: 100, isPlayer: false },
    ]);
    expect(fake.calls).toContain('includeUser:true');
  });

  it('игрок ниже топа — его строка последней, соседи с площадки не попадают', async () => {
    const fake = createFake();
    fake.state.entry = { score: 40, rank: 57, player: { publicName: '' } };
    fake.state.entries = [
      { score: 900, rank: 1, player: { publicName: 'Ульрих' } },
      { score: 41, rank: 56, player: { publicName: 'Сосед' } },
      { score: 40, rank: 57, player: { publicName: '' } },
    ];
    const { platform } = await started(fake);

    expect(await platform.getLeaderboard('best', 1)).toEqual([
      { rank: 1, name: 'Ульрих', score: 900, isPlayer: false },
      { rank: 57, name: 'Мортен', score: 40, isPlayer: true },
    ]);
  });

  it('у игрока ниже топа нет и имени — прочерк', async () => {
    const fake = createFake();
    fake.state.name = '';
    fake.state.entry = { score: 40, rank: 57, player: { publicName: '' } };
    fake.state.entries = [{ score: 900, rank: 1, player: { publicName: 'Ульрих' } }];
    const { platform } = await started(fake);

    const table = await platform.getLeaderboard('best', 1);
    expect(table.at(-1)).toEqual({ rank: 57, name: '—', score: 40, isPlayer: true });
  });

  it('своей записи ещё нет — в таблице только топ', async () => {
    const fake = createFake();
    fake.state.entryFails = true;
    fake.state.entries = [{ score: 900, rank: 1, player: { publicName: 'Ульрих' } }];
    const { platform } = await started(fake);

    expect(await platform.getLeaderboard('best', 10)).toEqual([
      { rank: 1, name: 'Ульрих', score: 900, isPlayer: false },
    ]);
  });

  it('гостю своя строка не запрашивается и не отмечается', async () => {
    const fake = createFake();
    fake.state.authorized = false;
    fake.state.entries = [{ score: 900, rank: 1, player: { publicName: 'Ульрих' } }];
    const { platform } = await started(fake);

    const table = await platform.getLeaderboard('best', 1);
    expect(table.every((row) => !row.isPlayer)).toBe(true);
    expect(fake.calls).toContain('includeUser:false');
  });

  it('площадка сломалась на проверке входа — таблицы нет', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('isAuthorized');
    expect(await platform.getLeaderboard('best', 10)).toEqual([]);
  });

  it('таблица не отдалась — покажем местный рекорд', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('getEntries');
    expect(await platform.getLeaderboard('best', 10)).toEqual([]);
  });
});

describe('флаги, язык и события площадки', () => {
  it('флаги отдаются', async () => {
    const { platform } = await started();
    expect(await platform.getFlags()).toEqual({ shop: 'on' });
  });

  it('флаги не отдались — работаем без них', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('getFlags');
    expect(await platform.getFlags()).toEqual({});
  });

  it('метода флагов нет — работаем без них', async () => {
    const fake = createFake();
    delete fake.sdk.getFlags;
    const { platform } = await started(fake);
    expect(await platform.getFlags()).toEqual({});
  });

  it('язык берётся у площадки', async () => {
    const fake = createFake();
    fake.sdk.environment.i18n.lang = 'en';
    const { platform } = await started(fake);
    expect(platform.getLang()).toBe('en');
  });

  it('площадки нет — язык по умолчанию', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect(platform.getLang()).toBe('ru');
  });

  it('готовность сообщается один раз по команде', async () => {
    const { platform, fake } = await started();
    platform.gameReady();
    expect(fake.calls).toContain('ready');
  });

  it('готовность не приняли — не падаем', async () => {
    const { platform, fake } = await started();
    fake.throwOn.add('ready');
    expect(() => {
      platform.gameReady();
    }).not.toThrow();
  });

  it('пары старт/стоп не задваиваются', async () => {
    const { platform, fake } = await started();
    platform.gameReady();
    platform.gameplayStart();
    platform.gameplayStart();
    platform.gameplayStop();
    platform.gameplayStop();
    platform.gameplayStart();
    expect(fake.calls.filter((call) => call === 'start' || call === 'stop')).toEqual([
      'start',
      'stop',
      'start',
    ]);
  });

  it('игра началась раньше площадки — старт доезжает, но только после готовности', async () => {
    // Без этого start уходит в пустоту, а первый же stop приходит непарным —
    // именно так площадка и ловит игру на нарушении. Порядок тоже важен:
    // сначала «загрузился», потом «играю».
    const fake = createFake();
    const platform = createYandexPlatform();
    platform.gameplayStart();

    install(fake.sdk);
    await platform.init();
    expect(fake.calls).toEqual([]);

    platform.gameReady();
    expect(fake.calls).toEqual(['ready', 'start']);

    platform.gameplayStop();
    expect(fake.calls).toEqual(['ready', 'start', 'stop']);
  });

  it('игра ещё не началась — готовность сама по себе старт не шлёт', async () => {
    const { platform, fake } = await started();
    platform.gameReady();
    expect(fake.calls).toEqual(['ready']);
  });

  it('до сообщения о готовности геймплейные события не уходят', async () => {
    const { platform, fake } = await started();
    platform.gameplayStart();
    platform.gameplayStop();
    expect(fake.calls).toEqual([]);
  });

  it('площадка отказала на старте — состояние всё равно сходится', async () => {
    const { platform, fake } = await started();
    platform.gameReady();
    fake.throwOn.add('start');
    fake.throwOn.add('stop');
    expect(() => {
      platform.gameplayStart();
      platform.gameplayStop();
    }).not.toThrow();
  });

  it('площадки нет — пары никуда не уходят', async () => {
    const platform = createYandexPlatform();
    await platform.init();
    expect(() => {
      platform.gameReady();
      platform.gameplayStart();
      platform.gameplayStop();
    }).not.toThrow();
  });
});

describe('полноэкранная реклама', () => {
  it('показалась и закрылась — «показана»', async () => {
    const { platform, fake } = await started();
    const shown = platform.showFullscreen();
    fake.fullscreen().onOpen?.();
    fake.fullscreen().onClose?.(true);
    expect(await shown).toBe('shown');
  });

  it('площадка решила не показывать (частота) — «пропущена»', async () => {
    const { platform, fake } = await started();
    const shown = platform.showFullscreen();
    fake.fullscreen().onClose?.(false);
    expect(await shown).toBe('skipped');
  });

  it('ошибка, нет сети, бросил вызов — «ошибка», и игра не зависает', async () => {
    const { platform, fake } = await started();
    const failed = platform.showFullscreen();
    fake.fullscreen().onError?.(new Error('нет'));
    expect(await failed).toBe('error');

    const offline = platform.showFullscreen();
    fake.fullscreen().onOffline?.();
    expect(await offline).toBe('error');

    fake.throwOn.add('showFullscreenAdv');
    expect(await platform.showFullscreen()).toBe('error');
  });

  it('поздние коллбэки ответ не меняют', async () => {
    const { platform, fake } = await started();
    const shown = platform.showFullscreen();
    fake.fullscreen().onError?.(new Error('нет'));
    fake.fullscreen().onClose?.(true);
    expect(await shown).toBe('error');
  });

  it('SDK молчит — через пятнадцать секунд отпускаем', async () => {
    const { platform } = await started();
    vi.useFakeTimers();
    const shown = platform.showFullscreen();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await shown).toBe('error');
  });

  it('открылась и зависла — короткий сторож не обрывает, длинный отпускает', async () => {
    const { platform, fake } = await started();
    vi.useFakeTimers();
    const shown = platform.showFullscreen();
    fake.fullscreen().onOpen?.();
    let done = false;
    void shown.then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await shown).toBe('error');
  });

  it('рекламы в SDK нет — сразу «ошибка»', async () => {
    const fake = createFake();
    delete fake.sdk.adv;
    const { platform } = await started(fake);
    expect(await platform.showFullscreen()).toBe('error');
  });
});

// Сторож отпустил игру, а ролик всё-таки открылся (медленная сеть): звук и
// поле под рекламой — нарушение п. 4.7, как в matching-game.
describe('реклама открылась после сторожа', () => {
  async function late(kind: 'rewarded' | 'fullscreen') {
    const started_ = await started();
    const { platform, fake } = started_;
    const seen: boolean[] = [];
    platform.onPause((paused) => seen.push(paused));
    vi.useFakeTimers();
    const shown =
      kind === 'rewarded' ? platform.showRewarded('ремонт') : platform.showFullscreen();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await shown).toBe('error');
    const callbacks = () => (kind === 'rewarded' ? fake.ad() : fake.fullscreen());
    return { ...started_, seen, callbacks };
  }

  it('ролик за награду снова ставит игру на паузу до закрытия', async () => {
    const { seen, fake } = await late('rewarded');
    expect(seen).toEqual([]);
    fake.ad().onOpen?.();
    expect(seen).toEqual([true]);
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(seen).toEqual([true, false]);
  });

  it('полноэкранная — так же, и ошибка тоже снимает паузу', async () => {
    const { seen, fake } = await late('fullscreen');
    fake.fullscreen().onOpen?.();
    expect(seen).toEqual([true]);
    fake.fullscreen().onError?.(new Error('оборвалась'));
    expect(seen).toEqual([true, false]);
  });

  it('опоздавшая и зависшая — через три минуты отпускаем', async () => {
    const { seen, callbacks } = await late('fullscreen');
    callbacks().onOpen?.();
    await vi.advanceTimersByTimeAsync(179_000);
    expect(seen).toEqual([true]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(seen).toEqual([true, false]);
  });

  it('resume площадки не снимает паузу, пока опоздавшая реклама на экране', async () => {
    const { seen, fake } = await late('rewarded');
    fake.emit('game_api_pause');
    fake.ad().onOpen?.();
    fake.emit('game_api_resume');
    expect(seen).toEqual([true]);
    fake.ad().onClose?.();
    expect(seen).toEqual([true, false]);
  });

  it('повторный onOpen и поздний onClose без onOpen паузу не ломают', async () => {
    const { seen, fake } = await late('rewarded');
    fake.ad().onClose?.();
    expect(seen).toEqual([]);
    fake.ad().onOpen?.();
    fake.ad().onOpen?.();
    fake.ad().onClose?.();
    fake.ad().onClose?.();
    expect(seen).toEqual([true, false]);
  });
});

// Сторож отказался от ролика, а игрок его всё-таки досмотрел: награда
// приходит отдельным каналом, после закрытия ролика.
describe('поздняя награда', () => {
  async function timedOut() {
    const started_ = await started();
    const rewards: string[] = [];
    started_.platform.onLateReward((placement) => rewards.push(placement));
    vi.useFakeTimers();
    const shown = started_.platform.showRewarded('ремонт');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await shown).toBe('error');
    return { ...started_, rewards };
  }

  it('досмотрел опоздавший ролик — награда приходит после закрытия', async () => {
    const { fake, rewards } = await timedOut();
    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    expect(rewards).toEqual([]);
    fake.ad().onClose?.();
    expect(rewards).toEqual(['ремонт']);
  });

  it('закрыл опоздавший ролик, не досмотрев, — награды нет', async () => {
    const { fake, rewards } = await timedOut();
    fake.ad().onOpen?.();
    fake.ad().onClose?.();
    expect(rewards).toEqual([]);
  });

  it('опоздавший ролик оборвался ошибкой — награды нет', async () => {
    const { fake, rewards } = await timedOut();
    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    fake.ad().onError?.(new Error('оборвался'));
    expect(rewards).toEqual([]);
  });

  it('досмотрел и ролик завис — награду отдаём, когда отпускаем', async () => {
    const { fake, rewards } = await timedOut();
    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(rewards).toEqual(['ремонт']);
  });

  it('награда приходит один раз, сколько бы коллбэков ни было', async () => {
    const { fake, rewards } = await timedOut();
    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    fake.ad().onClose?.();
    expect(rewards).toEqual(['ремонт']);
  });

  it('обычный показ поздним каналом не идёт', async () => {
    const { platform, fake } = await started();
    const rewards: string[] = [];
    platform.onLateReward((placement) => rewards.push(placement));
    const shown = platform.showRewarded('ремонт');
    fake.ad().onOpen?.();
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(await shown).toBe('rewarded');
    expect(rewards).toEqual([]);
  });

  it('ответ уже был ошибкой площадки — позднюю награду не засчитываем', async () => {
    const { platform, fake } = await started();
    const rewards: string[] = [];
    platform.onLateReward((placement) => rewards.push(placement));
    const shown = platform.showRewarded('ремонт');
    fake.ad().onError?.(new Error('нет рекламы'));
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(await shown).toBe('error');
    expect(rewards).toEqual([]);
  });

  it('отписка работает', async () => {
    const { platform, fake } = await started();
    const rewards: string[] = [];
    const off = platform.onLateReward((placement) => rewards.push(placement));
    off();
    vi.useFakeTimers();
    void platform.showRewarded('ремонт');
    await vi.advanceTimersByTimeAsync(15_000);
    fake.ad().onRewarded();
    fake.ad().onClose?.();
    expect(rewards).toEqual([]);
  });
});

describe('паузы площадки', () => {
  it('game_api_pause и game_api_resume доходят до подписчиков', async () => {
    const { platform, fake } = await started();
    const seen: boolean[] = [];
    const off = platform.onPause((paused) => seen.push(paused));
    fake.emit('game_api_pause');
    fake.emit('game_api_resume');
    off();
    fake.emit('game_api_pause');
    expect(seen).toEqual([true, false]);
  });
});
