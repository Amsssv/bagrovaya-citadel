/**
 * Единственный источник случайности в проекте. Math.random запрещён линтером:
 * без общего сида нет ни воспроизводимого боя, ни одинакового для всех
 * испытания дня, ни баг-репорта, который можно повторить.
 */
export interface Rng {
  /** Дробное в [0, 1). */
  next(): number;
  /** Целое в [min, max). Пустой диапазон — ошибка. */
  int(min: number, max: number): number;
  /** Случайный элемент. Пустой массив — ошибка. */
  pick<T>(items: readonly T[]): T;
  /** Новый перемешанный массив; исходный не трогает. */
  shuffle<T>(items: readonly T[]): T[];
  /**
   * Независимый поток с собственным счётчиком.
   *
   * Зависит только от сида и соли, но **не** от того, сколько раз крутили
   * родителя. Иначе правка, добавившая один бросок в досыпку, сдвинула бы
   * состав волны — и все сохранённые сиды перестали бы воспроизводиться.
   */
  fork(salt: string): Rng;
  /**
   * Где поток сейчас стоит. Нужен и сохранению забега, и песочным часам: без
   * снимка перезапуск ночи выдал бы другую досыпку, а загруженный забег разошёлся
   * бы с тем, который сохраняли.
   */
  snapshot(): RngSnapshot;
}

/** Простые числа — снимок кладётся в сохранение как есть. */
export interface RngSnapshot {
  readonly seed: number;
  readonly state: number;
}

/** Перемешивание битов: разносит близкие сиды по всему диапазону. */
function mix(value: number): number {
  let h = value | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** FNV-1a по строке — детерминированно и одинаково на всех платформах. */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  return rngFrom(seed, seed | 0);
}

/** Поток, продолжающий с сохранённого места. */
export function restoreRng(snapshot: RngSnapshot): Rng {
  return rngFrom(snapshot.seed, snapshot.state);
}

function rngFrom(seed: number, initial: number): Rng {
  let state = initial;

  // mulberry32: 32 бита состояния, период 2^32, проходит базовые тесты
  // равномерности и укладывается в пять строк — этого хватает для игры.
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max <= min) {
      throw new RangeError(`Пустой диапазон: int(${String(min)}, ${String(max)})`);
    }
    return min + Math.floor(next() * (max - min));
  };

  return {
    next,
    int,

    pick<T>(items: readonly T[]): T {
      // Пустой массив отсекает int: диапазон [0, 0) — ошибка.
      return items[int(0, items.length)] as T;
    },

    shuffle<T>(items: readonly T[]): T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i--) {
        const j = int(0, i + 1);
        const swap = result[i] as T;
        result[i] = result[j] as T;
        result[j] = swap;
      }
      return result;
    },

    fork(salt: string): Rng {
      // Считаем от исходного сида, а не от текущего state — иначе поток зависел
      // бы от истории вызовов родителя.
      return createRng(mix(seed ^ hashString(salt)));
    },

    snapshot(): RngSnapshot {
      return { seed, state };
    },
  };
}
