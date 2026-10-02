/**
 * Ограничитель записи сохранения.
 *
 * Пишем не чаще раза в заданный срок, а несохранённое сбрасываем
 * принудительно — когда игра уходит в фон или вкладку закрывают, второго
 * шанса не будет. Повтор того же значения не пишется вовсе. Облако идёт с
 * интервалом (у площадки лимит на запись), сейв на устройство — со сроком 0,
 * то есть на каждое изменение.
 *
 * Времени внутри нет: его передаёт вызывающий. Так ограничитель проверяется
 * обычными тестами, без подмены таймеров.
 */
export interface SaveGate {
  /** Записать, если срок подошёл. Возвращает true, если записали. */
  request(value: string, now: number): boolean;
  /** Записать немедленно, не глядя на срок. */
  flush(now: number): boolean;
  /** Есть ли изменения, которые ещё не легли в хранилище. */
  readonly pending: boolean;
}

export function createSaveGate(write: (value: string) => void, minIntervalMs: number): SaveGate {
  let lastWritten: string | null = null;
  let lastWriteAt = Number.NEGATIVE_INFINITY;
  let waiting: string | null = null;

  const commit = (value: string, now: number): void => {
    write(value);
    lastWritten = value;
    lastWriteAt = now;
    waiting = null;
  };

  return {
    request(value, now) {
      if (value === lastWritten) {
        waiting = null;
        return false;
      }
      if (now - lastWriteAt < minIntervalMs) {
        waiting = value;
        return false;
      }
      commit(value, now);
      return true;
    },

    flush(now) {
      if (waiting === null) return false;
      commit(waiting, now);
      return true;
    },

    get pending() {
      return waiting !== null;
    },
  };
}
