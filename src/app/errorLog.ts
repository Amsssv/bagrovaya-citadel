/**
 * Ошибки в проде. Своего сервера у игры нет, а у Яндекса нет журнала ошибок
 * для игр, поэтому так:
 *
 *   • всё, что упало мимо try/catch, и все отклонённые промисы — в консоль с
 *     меткой игры: её видно в панели отладки площадки и в удалённой отладке
 *     телефона;
 *   • последние записи — в памяти (`window.__citadelErrors`): при жалобе
 *     игрока их достают одной строкой из консоли;
 *   • одна и та же ошибка, падающая каждый кадр, пишется один раз с
 *     числом повторов, а не забивает консоль.
 */
export interface ErrorRecord {
  readonly at: string;
  readonly message: string;
  readonly where: string;
  count: number;
}

const LIMIT = 20;
const TAG = '[Багровая Цитадель]';

export interface ErrorLog {
  readonly records: readonly ErrorRecord[];
  record(message: string, where: string, now?: Date): ErrorRecord;
}

export function createErrorLog(write: (line: string) => void): ErrorLog {
  const records: ErrorRecord[] = [];
  return {
    records,
    record(message, where, now = new Date()) {
      const same = records.find((item) => item.message === message && item.where === where);
      if (same !== undefined) {
        same.count += 1;
        return same;
      }
      const entry: ErrorRecord = { at: now.toISOString(), message, where, count: 1 };
      records.push(entry);
      if (records.length > LIMIT) records.shift();
      write(`${TAG} ${message}${where === '' ? '' : ` (${where})`}`);
      return entry;
    },
  };
}

/** Текст ошибки из чего угодно, что бросили. */
export function describeError(reason: unknown): string {
  if (reason instanceof Error) return `${reason.name}: ${reason.message}`;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason) ?? String(reason);
  } catch {
    return String(reason);
  }
}

/** Подписаться на ошибки окна. Возвращает журнал. */
export function installErrorLog(
  target: Window = window,
  write: (line: string) => void = (line) => {
    console.error(line);
  },
): ErrorLog {
  const log = createErrorLog(write);
  target.addEventListener('error', (event) => {
    const where =
      event.filename === '' || event.filename === undefined
        ? ''
        : `${event.filename}:${String(event.lineno)}`;
    log.record(describeError(event.error ?? event.message), where);
  });
  target.addEventListener('unhandledrejection', (event) => {
    log.record(describeError(event.reason), 'promise');
  });
  (target as unknown as { __citadelErrors: readonly ErrorRecord[] }).__citadelErrors = log.records;
  return log;
}
