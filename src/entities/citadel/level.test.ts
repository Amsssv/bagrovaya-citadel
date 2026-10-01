import { describe, expect, it } from 'vitest';

import { DEFAULT_LEVEL_ID, hasPotions, levelById } from './level';
import type { CitadelLevel } from './level';

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
    id: 'hungry-night',
    name: 'Голодная ночь',
    hint: 'Потиров нет',
    resources: ['stone', 'thorn', 'ash', 'fog'],
    startSwaps: 120,
    leaderboard: 'hungry-night',
  },
];

describe('выбор цитадели', () => {
  it('находит цитадель по имени', () => {
    expect(levelById(LEVELS, 'hungry-night')?.name).toBe('Голодная ночь');
  });

  it('незнакомое имя — ничего: сейв с чужой цитаделью не должен ронять запуск', () => {
    expect(levelById(LEVELS, 'саркофаг')).toBeNull();
  });

  it('первой идёт Багровая — с неё начинают', () => {
    expect(DEFAULT_LEVEL_ID).toBe('crimson');
  });
});

describe('есть ли на поле потиры', () => {
  it('кровь в наборе — потиры будут', () => {
    expect(hasPotions(LEVELS[0] as CitadelLevel)).toBe(true);
  });

  it('крови в наборе нет — потиров не будет вовсе (§12)', () => {
    // Потир рождается только из тройки крови (§5), поэтому «потиров нет» — это
    // ровно «крови на поле нет», а не отдельный запрет.
    expect(hasPotions(LEVELS[1] as CitadelLevel)).toBe(false);
  });
});
