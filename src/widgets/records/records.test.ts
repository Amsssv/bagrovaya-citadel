import { describe, expect, it } from 'vitest';

import type { LeaderboardEntry } from '@/shared/api';

import { recordsView } from './records';

const BEST = { score: 420, nights: 12 };
const ROWS: LeaderboardEntry[] = [{ rank: 1, name: 'Ульрих', score: 900, isPlayer: false }];

describe('летопись рекордов на экране', () => {
  it('площадки нет — остаётся своя строка, и это не ошибка', () => {
    const view = recordsView({ best: BEST, ready: false, mode: 'guest', rows: ROWS, limit: 10 });
    expect(view.state).toEqual({ kind: 'offline' });
    expect(view.best).toEqual(BEST);
    expect(view.canSignIn).toBe(false);
  });

  it('таблица отдалась — показываем её', () => {
    const view = recordsView({
      best: BEST,
      ready: true,
      mode: 'authorized',
      rows: ROWS,
      limit: 10,
    });
    expect(view.state).toEqual({ kind: 'table', rows: ROWS });
    expect(view.canSignIn).toBe(false);
  });

  it('таблица пуста — говорим об этом, а не показываем пустоту', () => {
    const view = recordsView({ best: BEST, ready: true, mode: 'authorized', rows: [], limit: 10 });
    expect(view.state).toEqual({ kind: 'empty' });
  });

  it('гость видит таблицу, но своей строки в ней нет — зовём войти', () => {
    const view = recordsView({ best: BEST, ready: true, mode: 'guest', rows: ROWS, limit: 10 });
    expect(view.state).toEqual({ kind: 'table', rows: ROWS });
    expect(view.canSignIn).toBe(true);
  });

  it('своя строка в топе — таблица как есть, но не длиннее летописи', () => {
    const rows = ranks(1, 5).map((row) => ({ ...row, isPlayer: row.rank === 3 }));
    const view = recordsView({ best: BEST, ready: true, mode: 'authorized', rows, limit: 4 });
    expect(view.state).toEqual({ kind: 'table', rows: rows.slice(0, 4) });
  });

  it('своя строка ниже топа — видна через разрыв, в пределах летописи', () => {
    const top = ranks(1, 10);
    const mine = { rank: 57, name: 'Мортен', score: 5, isPlayer: true };
    const view = recordsView({
      best: BEST,
      ready: true,
      mode: 'authorized',
      rows: [...top, mine],
      limit: 10,
    });
    expect(view.state).toEqual({ kind: 'table', rows: [...top.slice(0, 8), 'gap', mine] });
  });
});

function ranks(from: number, to: number): LeaderboardEntry[] {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    rank: from + i,
    name: `Игрок ${String(from + i)}`,
    score: 1000 - i,
    isPlayer: false,
  }));
}
