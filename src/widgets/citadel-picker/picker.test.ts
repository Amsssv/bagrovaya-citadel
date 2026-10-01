import { describe, expect, it } from 'vitest';

import type { CitadelLevel } from '@/entities/citadel';

import { pickerRows } from './picker';

const LEVELS: CitadelLevel[] = [
  {
    id: 'crimson',
    name: 'Багровая',
    hint: 'База',
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    startSwaps: 25,
    leaderboard: 'crimson',
  },
  {
    id: 'ash-crypt',
    name: 'Крипта Праха',
    hint: 'Мортиры',
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    startSwaps: 25,
    leaderboard: 'ash-crypt',
  },
];

describe('список цитаделей', () => {
  it('показывает все: это набор уровней, а не кампания (§12)', () => {
    expect(pickerRows(LEVELS, 'crimson', {}).map((row) => row.level.name)).toEqual([
      'Багровая',
      'Крипта Праха',
    ]);
  });

  it('отмечает текущую', () => {
    const rows = pickerRows(LEVELS, 'ash-crypt', {});
    expect(rows.map((row) => row.isCurrent)).toEqual([false, true]);
  });

  it('к каждой цитадели подставляет её собственный рекорд', () => {
    const rows = pickerRows(LEVELS, 'crimson', { 'ash-crypt': { score: 120, nights: 3 } });
    expect(rows.map((row) => row.best.nights)).toEqual([0, 3]);
  });

  it('уход с текущей цитадели бросает забег, и об этом говорит подпись', () => {
    const rows = pickerRows(LEVELS, 'crimson', {}, true);
    expect(rows.map((row) => row.action)).toEqual(['restart', 'abandon']);
  });

  it('забега нет — бросать нечего', () => {
    expect(pickerRows(LEVELS, 'crimson', {}, false).map((row) => row.action)).toEqual([
      'start',
      'start',
    ]);
  });
});
