/**
 * Типы Яндекс.Игр. Перенесены из соседнего проекта `matching-game` и дополнены
 * тем, чего там не было: серверным временем и флагами.
 */
declare global {
  interface YandexLeaderboardEntry {
    score: number;
    rank: number;
    player: { publicName: string };
  }

  /**
   * События площадки. `game_api_pause` приходит, когда поверх игры открывается
   * реклама, окно покупки или игрок ушёл со вкладки: по нему игра обязана
   * заглушить звук и встать на паузу.
   */
  type YandexGameEvent = 'game_api_pause' | 'game_api_resume';

  interface YandexProduct {
    id: string;
    title: string;
    description: string;
    price: string;
  }

  interface YandexPurchase {
    productID: string;
    purchaseToken: string;
  }

  interface YandexPayments {
    purchase(data: { id: string }): Promise<YandexPurchase>;
    getPurchases(): Promise<YandexPurchase[]>;
    consumePurchase(token: string): Promise<void>;
    getCatalog(): Promise<YandexProduct[]>;
  }

  interface YandexPlayer {
    isAuthorized(): boolean;
    getName(): string;
    getData(keys?: string[]): Promise<Record<string, unknown>>;
    setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  }

  interface YandexGamesSDK {
    on(event: YandexGameEvent, callback: () => void): void;
    off(event: YandexGameEvent, callback: () => void): void;
    environment: { i18n: { lang: string } };
    features: {
      LoadingAPI?: { ready(): void };
      GameplayAPI?: { start(): void; stop(): void };
    };
    auth: { openAuthDialog(): Promise<{ action: 'close' | 'login' }> };
    /** Блокировщик рекламы может не дать этой ветке подняться вовсе. */
    adv?: {
      showRewardedVideo(opts: {
        callbacks: {
          onOpen?: () => void;
          onRewarded(): void;
          onClose?: () => void;
          onError?: (e: unknown) => void;
        };
      }): void;
      /** Полноэкранная реклама: `onClose(wasShown)` — показалась ли вообще. */
      showFullscreenAdv?(opts: {
        callbacks: {
          onOpen?: () => void;
          onClose?: (wasShown: boolean) => void;
          onError?: (e: unknown) => void;
          onOffline?: () => void;
        };
      }): void;
    };
    serverTime?: () => number;
    getFlags?: () => Promise<Record<string, string>>;
    getPlayer(opts?: { scopes?: boolean }): Promise<YandexPlayer>;
    getPayments(options?: { signed?: boolean }): Promise<YandexPayments>;
    leaderboards?: {
      setScore(name: string, score: number): Promise<void>;
      getPlayerEntry(name: string): Promise<YandexLeaderboardEntry>;
      getEntries(
        name: string,
        opts?: { quantityTop?: number; includeUser?: boolean },
      ): Promise<{ entries: YandexLeaderboardEntry[] }>;
    };
  }

  interface Window {
    YaGames?: { init(): Promise<YandexGamesSDK> };
    /** Подъём SDK, начатый из входа в игру ещё до бандла (`yandex/earlyInit.ts`). */
    __yaSdkInit?: Promise<YandexGamesSDK>;
  }
}

export {};
