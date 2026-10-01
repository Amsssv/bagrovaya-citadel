import type { SaveData } from './save';

/**
 * Сейв на устройстве и в облаке Яндекса — какой брать.
 *
 * Как в matching-game: надёжное хранилище — устройство, облако — для
 * вошедшего игрока, чтобы прогресс переезжал между устройствами. Облако
 * берём, только если оно новее и игрок на этом устройстве ещё ничего не
 * сделал: иначе вход в аккаунт посреди забега стёр бы только что сыгранное.
 * Во всех остальных случаях в облако уходит местный сейв.
 */
export type SaveChoice = 'local' | 'cloud';

export function chooseSave(
  local: SaveData,
  cloud: SaveData | null,
  touchedHere: boolean,
): SaveChoice {
  if (cloud === null || touchedHere) return 'local';
  return cloud.savedAt > local.savedAt ? 'cloud' : 'local';
}
