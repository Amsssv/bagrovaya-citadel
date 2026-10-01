/**
 * Пул объектов. Во время боя на экране одновременно живут десятки снарядов и
 * цифр урона; создавать их по месту — верный способ поймать сборку мусора ровно
 * в тот момент, когда кадры нужнее всего.
 *
 * Пул ничего не знает про Phaser: объект создаёт и гасит переданный код,
 * поэтому сам пул проверяется обычными тестами.
 */
export interface Pool<T> {
  acquire(): T;
  release(item: T): void;
  releaseAll(): void;
  /** Сколько объектов создано за всё время. */
  readonly size: number;
  /** Сколько сейчас занято. */
  readonly active: number;
}

export function createPool<T>(factory: () => T, reset: (item: T) => void): Pool<T> {
  const free: T[] = [];
  const busy = new Set<T>();

  return {
    acquire(): T {
      const item = free.pop() ?? factory();
      busy.add(item);
      return item;
    },

    release(item: T): void {
      // Повторный возврат — не ошибка вызывающего, а обычное дело: анимацию мог
      // прервать пропуск. Но гасить и класть обратно надо ровно один раз.
      if (!busy.delete(item)) return;
      reset(item);
      free.push(item);
    },

    releaseAll(): void {
      for (const item of [...busy]) this.release(item);
    },

    get size(): number {
      return free.length + busy.size;
    },

    get active(): number {
      return busy.size;
    },
  };
}
