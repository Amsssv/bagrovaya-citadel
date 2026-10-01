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
} from './platform';

/**
 * Площадка для разработки и тестов.
 *
 * Держит всё в памяти и умеет притворяться сломанной: это единственный способ
 * заранее проверить то, что случится у игрока с блокировщиком рекламы, без
 * авторизации или вовсе вне Яндекса.
 */
export interface MockOptions {
  readonly mode?: PlayerMode;
  readonly rewarded?: RewardedResult;
  readonly fullscreen?: FullscreenResult;
  readonly products?: readonly Product[];
  readonly leaderboards?: Readonly<Record<string, readonly LeaderboardEntry[]>>;
  readonly flags?: Readonly<Record<string, string>>;
  readonly lang?: string;
  /** Серверное время недоступно — как у Яндекса без сети. */
  readonly serverTimeTrusted?: boolean;
  readonly now?: () => number;
}

export interface MockPlatform extends PlatformAdapter {
  /** Что записано в облако — для проверок в тестах. */
  readonly cloud: unknown;
  readonly calls: readonly string[];
  /** Площадка ставит игру на паузу — как `game_api_pause` у Яндекса. */
  emitPause(paused: boolean): void;
}

export function createMockPlatform(options: MockOptions = {}): MockPlatform {
  const calls: string[] = [];
  const scores = new Map<string, number>();
  const boards: Record<string, readonly LeaderboardEntry[]> = { ...options.leaderboards };
  const purchases: Purchase[] = [];
  const now = options.now ?? (() => 0);

  let ready = false;
  let mode: PlayerMode = options.mode ?? 'guest';
  let cloud: unknown = null;
  const pauseHandlers = new Set<(paused: boolean) => void>();

  return {
    get cloud() {
      return cloud;
    },
    get calls() {
      return calls;
    },
    emitPause(paused: boolean) {
      for (const handler of pauseHandlers) handler(paused);
    },
    showFullscreen(): Promise<FullscreenResult> {
      calls.push('showFullscreen');
      return Promise.resolve(options.fullscreen ?? 'shown');
    },
    onPause(handler: (paused: boolean) => void): () => void {
      pauseHandlers.add(handler);
      return () => {
        pauseHandlers.delete(handler);
      };
    },

    async init() {
      calls.push('init');
      ready = true;
      return Promise.resolve();
    },
    isReady: () => ready,

    loadData<T>(): Promise<T | null> {
      calls.push('loadData');
      return Promise.resolve(cloud as T | null);
    },
    saveData<T>(data: T): Promise<void> {
      calls.push('saveData');
      cloud = data;
      return Promise.resolve();
    },
    getServerTime(): Promise<ServerTime> {
      calls.push('getServerTime');
      return Promise.resolve({ ms: now(), trusted: options.serverTimeTrusted ?? true });
    },

    getPlayerMode: () => mode,
    requestAuth(): Promise<boolean> {
      calls.push('requestAuth');
      mode = 'authorized';
      return Promise.resolve(true);
    },

    showRewarded(placement): Promise<RewardedResult> {
      calls.push(`showRewarded:${placement}`);
      return Promise.resolve(options.rewarded ?? 'rewarded');
    },
    isRewardedAvailable: () => (options.rewarded ?? 'rewarded') !== 'error',

    getProducts(): Promise<Product[]> {
      calls.push('getProducts');
      return Promise.resolve([...(options.products ?? [])]);
    },
    purchase(sku): Promise<PurchaseResult> {
      calls.push(`purchase:${sku}`);
      const known = (options.products ?? []).some((product) => product.id === sku);
      if (!known) return Promise.resolve({ status: 'unavailable' });

      const bought: Purchase = {
        productId: sku,
        token: `token-${sku}-${String(purchases.length)}`,
      };
      purchases.push(bought);
      return Promise.resolve({ status: 'bought', purchase: bought });
    },
    consume(token): Promise<void> {
      calls.push(`consume:${token}`);
      const index = purchases.findIndex((purchase) => purchase.token === token);
      if (index >= 0) purchases.splice(index, 1);
      return Promise.resolve();
    },
    getUnprocessedPurchases(): Promise<Purchase[]> {
      calls.push('getUnprocessedPurchases');
      return Promise.resolve([...purchases]);
    },

    submitScore(board, score): Promise<void> {
      calls.push(`submitScore:${board}:${String(score)}`);
      // Площадка перезаписывает результат безусловно, поэтому лучший бережём сами.
      const best = scores.get(board) ?? Number.NEGATIVE_INFINITY;
      if (score > best) scores.set(board, score);
      return Promise.resolve();
    },
    getLeaderboard(board, limit): Promise<LeaderboardEntry[]> {
      calls.push(`getLeaderboard:${board}`);
      return Promise.resolve([...(boards[board] ?? [])].slice(0, limit));
    },

    getFlags(): Promise<Record<string, string>> {
      calls.push('getFlags');
      return Promise.resolve({ ...options.flags });
    },
    getLang: () => options.lang ?? 'ru',
    gameReady() {
      calls.push('gameReady');
    },
    gameplayStart() {
      calls.push('gameplayStart');
    },
    gameplayStop() {
      calls.push('gameplayStop');
    },
  };
}

/**
 * Площадка, которой нет вовсе: ни Яндекса, ни сети, ни разрешений.
 *
 * Именно это состояние обязано быть играбельным, поэтому оно вынесено
 * отдельной реализацией, а не собирается флагами.
 */
export function createAbsentPlatform(): PlatformAdapter {
  return {
    init: () => Promise.resolve(),
    isReady: () => false,
    loadData: () => Promise.resolve(null),
    saveData: () => Promise.resolve(),
    getServerTime: () => Promise.resolve({ ms: 0, trusted: false }),
    getPlayerMode: () => 'guest',
    requestAuth: () => Promise.resolve(false),
    showRewarded: () => Promise.resolve('error'),
    isRewardedAvailable: () => false,
    showFullscreen: () => Promise.resolve('error'),
    onPause: () => () => undefined,
    getProducts: () => Promise.resolve([]),
    purchase: () => Promise.resolve({ status: 'unavailable' }),
    consume: () => Promise.resolve(),
    getUnprocessedPurchases: () => Promise.resolve([]),
    submitScore: () => Promise.resolve(),
    getLeaderboard: () => Promise.resolve([]),
    getFlags: () => Promise.resolve({}),
    getLang: () => 'ru',
    gameReady: () => undefined,
    gameplayStart: () => undefined,
    gameplayStop: () => undefined,
  };
}
