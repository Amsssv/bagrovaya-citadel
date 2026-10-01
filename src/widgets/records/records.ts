import type { BestRecord } from '@/entities/player';
import type { LeaderboardEntry, PlayerMode } from '@/shared/api';

/**
 * Летопись рекордов (§13).
 *
 * Своя строка есть всегда: прогресс лежит на устройстве и не требует
 * регистрации. Таблица площадки — сверх того, и её отсутствие не должно
 * выглядеть поломкой.
 */
export type RecordsState =
  | { readonly kind: 'offline' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'table'; readonly rows: readonly RecordsRow[] };

/** Строка таблицы или разрыв «· · ·» перед своей строкой ниже топа. */
export type RecordsRow = LeaderboardEntry | 'gap';

export interface RecordsInput {
  readonly best: BestRecord;
  readonly ready: boolean;
  readonly mode: PlayerMode;
  readonly rows: readonly LeaderboardEntry[];
  /** Сколько строк помещается в летопись, разрыв тоже строка. */
  readonly limit: number;
}

export interface RecordsView {
  readonly best: BestRecord;
  readonly state: RecordsState;
  /** Гостю таблицу показываем, но своей строки в ней нет — зовём войти (§13). */
  readonly canSignIn: boolean;
}

export function recordsView(input: RecordsInput): RecordsView {
  const canSignIn = input.ready && input.mode === 'guest';

  if (!input.ready) return { best: input.best, state: { kind: 'offline' }, canSignIn };
  if (input.rows.length === 0) return { best: input.best, state: { kind: 'empty' }, canSignIn };
  return {
    best: input.best,
    state: { kind: 'table', rows: fitRows(input.rows, input.limit) },
    canSignIn,
  };
}

/**
 * Своя строка видна всегда, как в matching-game: игрок ниже топа — верх
 * таблицы ужимается, чтобы влезли разрыв и он сам.
 */
function fitRows(rows: readonly LeaderboardEntry[], limit: number): RecordsRow[] {
  const mine = rows.findIndex((row) => row.isPlayer);
  if (mine < limit) return rows.slice(0, limit);
  return [...rows.slice(0, limit - 2), 'gap', rows[mine]!];
}
