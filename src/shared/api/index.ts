export type { RawStorage, Storage } from './storage';
export { createBrowserStorage, createMemoryStorage, createSafeStorage } from './storage';
export type { SaveGate } from './saveGate';
export { createSaveGate } from './saveGate';
export type {
  LeaderboardEntry,
  PlatformAdapter,
  PlayerMode,
  Product,
  Purchase,
  PurchaseResult,
  FullscreenResult,
  RewardedResult,
  ServerTime,
} from './platform';
export { createPlatform } from './createPlatform';
export type { MockOptions, MockPlatform } from './mockPlatform';
export { createAbsentPlatform, createMockPlatform } from './mockPlatform';
export { createYandexPlatform } from './yandex/adapter';
