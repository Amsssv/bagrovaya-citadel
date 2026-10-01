import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserStorage, createMemoryStorage, createSafeStorage } from './storage';

/** Хранилище, которое ломается на всём, — приватный режим или переполнение. */
function brokenStorage() {
  return {
    getItem: () => {
      throw new Error('заблокировано');
    },
    setItem: () => {
      throw new Error('переполнено');
    },
    removeItem: () => {
      throw new Error('нельзя');
    },
  };
}

describe('хранилище в памяти', () => {
  it('пишет и читает', () => {
    const storage = createMemoryStorage();
    storage.write('ключ', 'значение');
    expect(storage.read('ключ')).toBe('значение');
  });

  it('незнакомый ключ — null', () => {
    expect(createMemoryStorage().read('нет')).toBeNull();
  });

  it('удаление стирает', () => {
    const storage = createMemoryStorage();
    storage.write('ключ', 'значение');
    storage.remove('ключ');
    expect(storage.read('ключ')).toBeNull();
  });
});

describe('обёртка не даёт хранилищу уронить игру', () => {
  it('чтение из сломанного даёт null, а не исключение', () => {
    const storage = createSafeStorage(brokenStorage());
    expect(storage.read('ключ')).toBeNull();
  });

  it('запись в сломанное молча не проходит', () => {
    const storage = createSafeStorage(brokenStorage());
    expect(() => {
      storage.write('ключ', 'значение');
    }).not.toThrow();
  });

  it('удаление из сломанного тоже не роняет', () => {
    const storage = createSafeStorage(brokenStorage());
    expect(() => {
      storage.remove('ключ');
    }).not.toThrow();
  });

  it('о поломке можно узнать, а не гадать', () => {
    const onError = vi.fn();
    createSafeStorage(brokenStorage(), onError).write('ключ', 'значение');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('исправное хранилище работает как обычно', () => {
    const inner = createMemoryStorage();
    const storage = createSafeStorage({
      getItem: (key) => inner.read(key),
      setItem: (key, value) => {
        inner.write(key, value);
      },
      removeItem: (key) => {
        inner.remove(key);
      },
    });
    storage.write('ключ', 'значение');
    expect(storage.read('ключ')).toBe('значение');
  });

  it('когда хранилища нет вовсе, игра всё равно работает', () => {
    const storage = createSafeStorage(null);
    expect(() => {
      storage.write('ключ', 'значение');
    }).not.toThrow();
    expect(storage.read('ключ')).toBeNull();
  });
});

describe('хранилище браузера', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('без localStorage игра всё равно запускается', () => {
    const storage = createBrowserStorage();
    expect(() => {
      storage.write('ключ', 'значение');
    }).not.toThrow();
    expect(storage.read('ключ')).toBeNull();
  });

  it('когда localStorage есть, пишет в него', () => {
    const inner = createMemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => inner.read(key),
        setItem: (key: string, value: string) => {
          inner.write(key, value);
        },
        removeItem: (key: string) => {
          inner.remove(key);
        },
      },
    });

    const storage = createBrowserStorage();
    storage.write('ключ', 'значение');
    expect(inner.read('ключ')).toBe('значение');
    storage.remove('ключ');
    expect(storage.read('ключ')).toBeNull();
  });

  it('бросающий доступ переживается и без обработчика ошибки', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('куки выключены');
      },
    });
    expect(() => createBrowserStorage()).not.toThrow();
  });

  it('сам доступ к localStorage может бросить — и это не роняет игру', () => {
    // Так ведут себя браузеры с выключенными куками: свойство есть, но
    // обращение к нему кидает.
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('куки выключены');
      },
    });

    const onError = vi.fn();
    const storage = createBrowserStorage(onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(storage.read('ключ')).toBeNull();
  });
});
