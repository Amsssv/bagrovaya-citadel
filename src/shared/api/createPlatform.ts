import { createAbsentPlatform } from './mockPlatform';
import type { PlatformAdapter } from './platform';
import { createYandexPlatform } from './yandex/adapter';

/**
 * Где мы запустились.
 *
 * Единственное место во всей игре, которое смотрит на `window`: дальше по коду
 * есть только `PlatformAdapter`. Скрипт SDK подключается в `index.html` и может
 * не подгрузиться — у игрока с блокировщиком, в офлайне, вне Яндекса вовсе.
 * Тогда берём реализацию «площадки нет»: она честно ничего не умеет, и игра
 * остаётся играбельной на местном сохранении.
 */
export function createPlatform(): PlatformAdapter {
  const hasYandex = typeof window !== 'undefined' && window.YaGames !== undefined;
  return hasYandex ? createYandexPlatform() : createAbsentPlatform();
}
