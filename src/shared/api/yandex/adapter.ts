import type {
  FullscreenResult,
  LeaderboardEntry,
  PlatformAdapter,
  PlayerMode,
  Product,
  Purchase,
  PurchaseResult,
  RewardedResult,
  ServerTime,
} from '../platform';

/**
 * Площадка Яндекс.Игр.
 *
 * Здесь собрано то, что уже больно далось в соседнем проекте `matching-game`, —
 * каждая мера ниже стоит за реальной поломкой, а не за осторожностью:
 *
 *   • **Парные gameplayStart/Stop.** Площадка ждёт строго парные события.
 *     Дёргать SDK из каждой точки кода нельзя: легко получить два stop подряд.
 *     Поэтому состояние выводится из одного флага, и в SDK уходит только
 *     настоящий переход.
 *
 *   • **Сторожевые таймеры у рекламы.** Сломанный SDK, блокировщик или ошибка
 *     MIME оставляют ролик без единого коллбэка — игра зависала бы навсегда.
 *     Пятнадцать секунд на «не позвали вовсе» и три минуты на «открылось, но не
 *     закрылось» заведомо длиннее любого ролика.
 *
 *   • **Очередь для setScore.** Площадка режет запись чаще раза в секунду и
 *     молча **отбрасывает** лишнее — из-за этого «побил свой рекорд, а он не
 *     записался». Все записи идут через одну очередь с зазором.
 *
 *   • **Лучший результат бережём сами.** `setScore` перезаписывает безусловно;
 *     это не «сохранить лучшее».
 *
 *   • **Паузы площадки.** `game_api_pause`/`game_api_resume` приходят не только
 *     на нашу рекламу, но и на окно покупки или вход — подписка ставится одна,
 *     сразу после подъёма SDK, и раздаётся всем, кто подписался через `onPause`.
 *
 * Ни один метод не бросает: при отказе площадки игра обязана остаться играбельной.
 */
const NO_CALLBACK_TIMEOUT_MS = 15_000;
const STUCK_AD_TIMEOUT_MS = 180_000;
const MIN_SET_SCORE_GAP_MS = 1000;
const SAVE_KEY = 'save';

/** Имя в таблице: публичное, иначе запасное, иначе прочерк. */
function nameOf(entry: YandexLeaderboardEntry, fallback: string): string {
  if (entry.player.publicName !== '') return entry.player.publicName;
  return fallback === '' ? '—' : fallback;
}

export function createYandexPlatform(): PlatformAdapter {
  let sdk: YandexGamesSDK | null = null;
  let player: YandexPlayer | null = null;
  let payments: YandexPayments | null = null;

  /** Что мы уже сообщили площадке про геймплей. */
  let gameplayRunning = false;
  /** Площадке сказали, что игра загрузилась. До этого «играю» не отправляют. */
  let readySent = false;

  /** Кто ждёт пауз площадки. */
  const pauseHandlers = new Set<(paused: boolean) => void>();
  const emitPause = (paused: boolean): void => {
    for (const handler of pauseHandlers) handler(paused);
  };

  let setScoreChain: Promise<void> = Promise.resolve();
  let lastSetScoreAt = 0;

  /** Отправить площадке текущее состояние геймплея. */
  const applyGameplay = (): void => {
    if (!readySent) return;
    try {
      if (gameplayRunning) sdk?.features.GameplayAPI?.start();
      else sdk?.features.GameplayAPI?.stop();
    } catch {
      /* площадка не обязана отвечать */
    }
  };

  const queueSetScore = (board: string, score: number): Promise<void> => {
    const run = setScoreChain.then(async () => {
      const gap = MIN_SET_SCORE_GAP_MS - (Date.now() - lastSetScoreAt);
      if (gap > 0) await new Promise<void>((resolve) => setTimeout(resolve, gap));
      lastSetScoreAt = Date.now();
      try {
        await sdk?.leaderboards?.setScore(board, score);
      } catch {
        /* лимит, гость или сеть — молча */
      }
    });
    setScoreChain = run;
    return run;
  };

  /**
   * Подъём SDK — один на всю жизнь адаптера. Язык нужен ещё до первого кадра
   * интерфейса, поэтому init зовут и при запуске, и позже из игры: второй
   * вызов ждёт тот же подъём, а не поднимает SDK заново.
   */
  let initOnce: Promise<void> | null = null;

  return {
    init(): Promise<void> {
      initOnce ??= (async () => {
        try {
          sdk = (await window.YaGames?.init()) ?? null;
          sdk?.on('game_api_pause', () => {
            emitPause(true);
          });
          sdk?.on('game_api_resume', () => {
            emitPause(false);
          });
        } catch {
          // Площадки нет или она не поднялась — играем без неё.
          return;
        }
        // Игрок и покупки поднимаются порознь: отказ одного не должен
        // отключать другое на всю сессию.
        try {
          player = (await sdk?.getPlayer({ scopes: false })) ?? null;
        } catch {
          // Без игрока — гость: местный сейв, без облака.
        }
        try {
          payments = (await sdk?.getPayments({ signed: false })) ?? null;
        } catch {
          // Без покупок — магазин закрыт.
        }
      })();
      return initOnce;
    },

    isReady: () => sdk !== null,

    async loadData<T>(): Promise<T | null> {
      try {
        if (player === null || !player.isAuthorized()) return null;
        const data = await player.getData([SAVE_KEY]);
        return (data[SAVE_KEY] as T | undefined) ?? null;
      } catch {
        return null;
      }
    },

    async saveData<T>(data: T): Promise<void> {
      try {
        if (player === null || !player.isAuthorized()) return;
        await player.setData({ [SAVE_KEY]: data }, true);
      } catch {
        /* облако недоступно — местный сейв уже записан */
      }
    },

    async getServerTime(): Promise<ServerTime> {
      try {
        const ms = sdk?.serverTime?.();
        if (typeof ms === 'number' && Number.isFinite(ms)) return { ms, trusted: true };
      } catch {
        /* ниже */
      }
      // Серверного времени нет: отдаём местное и честно помечаем недоверенным,
      // чтобы таймеры не раздавали награды за перевод часов.
      return { ms: Date.now(), trusted: false };
    },

    getPlayerMode(): PlayerMode {
      try {
        return player?.isAuthorized() === true ? 'authorized' : 'guest';
      } catch {
        return 'guest';
      }
    },

    async requestAuth(): Promise<boolean> {
      try {
        if (sdk === null) return false;
        const result = await sdk.auth.openAuthDialog();
        if (result.action !== 'login') return false;
        player = await sdk.getPlayer({ scopes: false });
        return player.isAuthorized();
      } catch {
        return false;
      }
    },

    showRewarded(placement: string): Promise<RewardedResult> {
      void placement;
      return new Promise<RewardedResult>((resolve) => {
        const adv = sdk?.adv;
        if (adv === undefined) {
          resolve('error');
          return;
        }

        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let rewarded = false;

        const settle = (result: RewardedResult): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        };
        // Сторож: если площадка замолчала, засчитываем награду, когда она уже
        // пришла, и ошибку, когда ролик так и не начался.
        const arm = (ms: number): void => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            settle(rewarded ? 'rewarded' : 'error');
          }, ms);
        };

        arm(NO_CALLBACK_TIMEOUT_MS);
        try {
          adv.showRewardedVideo({
            callbacks: {
              // Ролик точно на экране: короткий сторож снимаем, иначе он оборвал
              // бы показ длиннее пятнадцати секунд.
              onOpen: () => {
                arm(STUCK_AD_TIMEOUT_MS);
              },
              // Награда засчитана, но ролик ещё крутится — ждём закрытия.
              onRewarded: () => {
                rewarded = true;
              },
              onClose: () => {
                settle(rewarded ? 'rewarded' : 'closed');
              },
              onError: () => {
                settle('error');
              },
            },
          });
        } catch {
          settle('error');
        }
      });
    },

    isRewardedAvailable: () => sdk?.adv !== undefined,

    showFullscreen(): Promise<FullscreenResult> {
      return new Promise<FullscreenResult>((resolve) => {
        const show = sdk?.adv?.showFullscreenAdv;
        if (show === undefined) {
          resolve('error');
          return;
        }
        let settled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const settle = (result: FullscreenResult): void => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        };
        // Те же сторожа, что у ролика: без них сломанный SDK оставил бы игру
        // на паузе навсегда.
        const arm = (ms: number): void => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            settle('error');
          }, ms);
        };
        arm(NO_CALLBACK_TIMEOUT_MS);
        try {
          show.call(sdk?.adv, {
            callbacks: {
              onOpen: () => {
                arm(STUCK_AD_TIMEOUT_MS);
              },
              onClose: (wasShown) => {
                settle(wasShown ? 'shown' : 'skipped');
              },
              onError: () => {
                settle('error');
              },
              onOffline: () => {
                settle('error');
              },
            },
          });
        } catch {
          settle('error');
        }
      });
    },

    onPause(handler: (paused: boolean) => void): () => void {
      pauseHandlers.add(handler);
      return () => {
        pauseHandlers.delete(handler);
      };
    },

    async getProducts(): Promise<Product[]> {
      try {
        const catalog = (await payments?.getCatalog()) ?? [];
        return catalog.map((product) => ({
          id: product.id,
          title: product.title,
          description: product.description,
          price: product.price,
        }));
      } catch {
        return [];
      }
    },

    async purchase(sku: string): Promise<PurchaseResult> {
      if (payments === null) return { status: 'unavailable' };
      try {
        const bought = await payments.purchase({ id: sku });
        return {
          status: 'bought',
          purchase: { productId: bought.productID, token: bought.purchaseToken },
        };
      } catch {
        // Игрок закрыл окно или оплата не прошла — не ошибка игры.
        return { status: 'cancelled' };
      }
    },

    async consume(token: string): Promise<void> {
      try {
        await payments?.consumePurchase(token);
      } catch {
        /* не списалось — обработаем при следующем запуске */
      }
    },

    async getUnprocessedPurchases(): Promise<Purchase[]> {
      try {
        const list = (await payments?.getPurchases()) ?? [];
        return list.map((item) => ({ productId: item.productID, token: item.purchaseToken }));
      } catch {
        return [];
      }
    },

    async submitScore(board: string, score: number): Promise<void> {
      const leaderboards = sdk?.leaderboards;
      if (leaderboards === undefined || !Number.isFinite(score) || score <= 0) return;
      try {
        // Площадка перезаписывает безусловно, поэтому лучший бережём сами.
        const entry = await leaderboards.getPlayerEntry(board);
        if (score <= entry.score) return;
      } catch {
        /* записи ещё нет — просто отправляем */
      }
      await queueSetScore(board, score);
    },

    async getLeaderboard(board: string, limit: number): Promise<LeaderboardEntry[]> {
      try {
        const leaderboards = sdk?.leaderboards;
        if (leaderboards === undefined) return [];
        // Гость в таблице не участвует: показывать за него нечего, а просить у
        // площадки его строку — верный способ получить отказ.
        const me = player !== null && player.isAuthorized() ? player : null;
        // Свою строку берём отдельно и узнаём по месту, как в matching-game:
        // по имени не узнать — одноимённых игроков на площадке много.
        const [top, mine] = await Promise.allSettled([
          leaderboards.getEntries(board, { quantityTop: limit, includeUser: me !== null }),
          me === null ? Promise.reject(new Error('гость')) : leaderboards.getPlayerEntry(board),
        ]);
        if (top.status === 'rejected') return [];
        const myName = me?.getName() ?? '';
        const rank = mine.status === 'fulfilled' ? mine.value.rank : null;
        // С `includeUser` площадка добавляет соседей игрока — они не топ.
        const rows = top.value.entries
          .filter((entry) => entry.rank <= limit)
          .map((entry) => ({
            rank: entry.rank,
            name: nameOf(entry, ''),
            score: entry.score,
            isPlayer: entry.rank === rank,
          }));
        // Игрок ниже топа — его строка всё равно в таблице, последней.
        if (mine.status === 'fulfilled' && mine.value.rank > limit) {
          rows.push({
            rank: mine.value.rank,
            name: nameOf(mine.value, myName),
            score: mine.value.score,
            isPlayer: true,
          });
        }
        return rows;
      } catch {
        return [];
      }
    },

    async getFlags(): Promise<Record<string, string>> {
      try {
        return (await sdk?.getFlags?.()) ?? {};
      } catch {
        return {};
      }
    },

    // Чтение поля у объекта не бросает, поэтому здесь нет защитного catch:
    // он был бы недостижим.
    getLang: () => sdk?.environment.i18n.lang ?? 'ru',

    gameReady(): void {
      try {
        sdk?.features.LoadingAPI?.ready();
      } catch {
        /* площадка не обязана отвечать */
      }
      // Игра успевает начаться раньше, чем поднимается площадка: тот start ушёл
      // бы в пустоту, и первый же stop пришёл бы непарным. Досылаем его здесь —
      // и только здесь, чтобы «загрузился» всегда шло раньше «играю».
      readySent = true;
      if (gameplayRunning) applyGameplay();
    },

    gameplayStart(): void {
      if (gameplayRunning) return;
      gameplayRunning = true;
      applyGameplay();
    },

    gameplayStop(): void {
      if (!gameplayRunning) return;
      gameplayRunning = false;
      applyGameplay();
    },
  };
}
