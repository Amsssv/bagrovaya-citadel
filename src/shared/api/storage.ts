/**
 * Хранилище прогресса. Прогресс лежит на устройстве и не требует регистрации
 * (§13), но само хранилище — вещь ненадёжная: в приватном режиме оно бросает,
 * при переполнении бросает, за выключенными куками его может не быть вовсе.
 *
 * Поэтому наружу торчит один узкий интерфейс, а все обращения к платформе
 * завёрнуты в try/catch с безопасным значением по умолчанию. Игра обязана
 * работать при полном отказе хранилища — просто без сохранения.
 *
 * Тот же интерфейс потом получит облачный сейв Яндекса.
 */
export interface Storage {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

/** То, что умеет localStorage. Отдельным типом — чтобы его можно было подменить. */
export interface RawStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    read: (key) => data.get(key) ?? null,
    write: (key, value) => {
      data.set(key, value);
    },
    remove: (key) => {
      data.delete(key);
    },
  };
}

export function createSafeStorage(
  raw: RawStorage | null,
  onError: (error: unknown) => void = () => undefined,
): Storage {
  return {
    read(key) {
      try {
        return raw?.getItem(key) ?? null;
      } catch (error) {
        onError(error);
        return null;
      }
    },
    write(key, value) {
      try {
        raw?.setItem(key, value);
      } catch (error) {
        onError(error);
      }
    },
    remove(key) {
      try {
        raw?.removeItem(key);
      } catch (error) {
        onError(error);
      }
    },
  };
}

/**
 * Хранилище браузера. Само обращение к `localStorage` может бросить — например,
 * когда куки выключены, — поэтому даже доступ к свойству обёрнут.
 */
export function createBrowserStorage(onError: (error: unknown) => void = () => undefined): Storage {
  let raw: RawStorage | null = null;
  try {
    raw = (globalThis.localStorage as RawStorage | undefined | null) ?? null;
  } catch (error) {
    onError(error);
  }
  return createSafeStorage(raw, onError);
}
