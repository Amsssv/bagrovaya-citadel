/**
 * Всё общение с площадкой идёт через один интерфейс.
 *
 * Правило, от которого зависит, будет ли игра работать у половины игроков:
 * **при полном отказе SDK игра остаётся играбельной**. Ни один метод не бросает;
 * каждый возвращает безопасное значение по умолчанию. Сейв уходит в
 * localStorage, реклама гасит кнопку, таблица показывает локальный рекорд,
 * магазин прячется.
 *
 * Принудительной полноэкранной рекламы здесь нет и не будет — только rewarded,
 * и только по желанию игрока.
 */
export type PlayerMode = 'guest' | 'authorized';

export type RewardedResult = 'rewarded' | 'closed' | 'error';

/** Чем кончилась полноэкранная реклама: показалась, не показалась, ошибка. */
export type FullscreenResult = 'shown' | 'skipped' | 'error';

export interface Product {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Уже отформатированная цена от площадки: «59 YAN». */
  readonly price: string;
}

export interface Purchase {
  readonly productId: string;
  readonly token: string;
}

export type PurchaseResult =
  | { readonly status: 'bought'; readonly purchase: Purchase }
  | { readonly status: 'cancelled' }
  | { readonly status: 'unavailable' };

export interface LeaderboardEntry {
  readonly rank: number;
  readonly name: string;
  readonly score: number;
  readonly isPlayer: boolean;
}

/**
 * Время платформы. `trusted: false` — серверное время недоступно, значение
 * местное. Всё, что тикает, обязано смотреть на этот флаг: перевод часов на
 * телефоне не должен открывать сундуки и наливать сердца.
 */
export interface ServerTime {
  readonly ms: number;
  readonly trusted: boolean;
}

export interface PlatformAdapter {
  init(): Promise<void>;
  isReady(): boolean;

  // сейв
  loadData<T>(): Promise<T | null>;
  saveData<T>(data: T): Promise<void>;
  getServerTime(): Promise<ServerTime>;

  // игрок
  getPlayerMode(): PlayerMode;
  requestAuth(): Promise<boolean>;

  // реклама
  showRewarded(placement: string): Promise<RewardedResult>;
  isRewardedAvailable(): boolean;
  /**
   * Полноэкранная реклама — в естественную паузу игры (новый забег), как в
   * matching-game. Ответ приходит, когда реклама кончилась по любой причине.
   */
  showFullscreen(): Promise<FullscreenResult>;
  /**
   * Площадка сама ставит игру на паузу (`game_api_pause`): поверх открылось её
   * окно. По паузе глушим звук и останавливаем игру (требование 1.19.4).
   * Возвращает отписку.
   */
  onPause(handler: (paused: boolean) => void): () => void;

  // покупки
  getProducts(): Promise<Product[]>;
  purchase(sku: string): Promise<PurchaseResult>;
  consume(token: string): Promise<void>;
  getUnprocessedPurchases(): Promise<Purchase[]>;

  // летопись рекордов
  submitScore(board: string, score: number): Promise<void>;
  getLeaderboard(board: string, limit: number): Promise<LeaderboardEntry[]>;

  // прочее
  getFlags(): Promise<Record<string, string>>;
  getLang(): string;
  gameReady(): void;
  gameplayStart(): void;
  gameplayStop(): void;
}
