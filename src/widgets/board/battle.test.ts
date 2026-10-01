import { describe, expect, it } from 'vitest';

import type { NightEvent } from '@/entities/wave';

import { HIT_FLASH_MS, battleDuration, buildCues, hitFlashTint } from './battle';
import type { BattleCue } from './battle';

const HEIGHT = 6;

function cues(events: NightEvent[]): BattleCue[] {
  return buildCues(events, HEIGHT);
}

const types = (list: readonly BattleCue[]): string[] => list.map((cue) => cue.type);

describe('выход охотника', () => {
  it('появляется в нижнем ряду своего столбца', () => {
    const [cue] = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 2 },
      { type: 'end', at: 100, reason: 'cleared' },
    ]);
    expect(cue).toEqual({
      type: 'spawn',
      at: 0,
      id: 'h1',
      kind: 'hunter',
      column: 2,
      row: 5,
      boss: false,
      hp: 0,
    });
  });

  it('босс выходит с меткой и запасом жизней — для полоски внизу', () => {
    const [cue] = cues([
      { type: 'spawn', at: 0, id: 'p', kind: 'preacher', column: 1, hp: 97, boss: true },
      { type: 'hit', at: 50, id: 'p', amount: 6, hpLeft: 91 },
      { type: 'end', at: 100, reason: 'cleared' },
    ]);
    expect(cue).toMatchObject({ boss: true, hp: 97 });
    expect(
      cues([
        { type: 'hit', at: 50, id: 'p', amount: 6, hpLeft: 91 },
        { type: 'end', at: 100, reason: 'cleared' },
      ])[0],
    ).toMatchObject({ type: 'damage', hpLeft: 91 });
  });

  it('конец ночи всегда последней подсказкой', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 2 },
      { type: 'end', at: 500, reason: 'cleared' },
    ]);
    expect(list.at(-1)?.type).toBe('end');
  });

  it('пустой бой даёт только конец', () => {
    expect(types(cues([{ type: 'end', at: 0, reason: 'cleared' }]))).toEqual(['end']);
  });
});

describe('шаги по столбцу', () => {
  const walk: NightEvent[] = [
    { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
    { type: 'move', at: 500, id: 'h1', from: 5, to: 4, y: 4.49 },
    { type: 'move', at: 1000, id: 'h1', from: 4, to: 3, y: 3.49 },
    { type: 'leak', at: 2000, id: 'h1', column: 1, damage: 3, heartsLeft: 27, y: -0.01 },
    { type: 'end', at: 2050, reason: 'cleared' },
  ];
  const marchesOf = (list: readonly BattleCue[]) =>
    list.flatMap((cue) => (cue.type === 'march' ? [cue] : []));

  it('охотник идёт с момента выхода и после каждого перехода между рядами', () => {
    expect(marchesOf(cues(walk)).map((cue) => cue.at)).toEqual([0, 500, 1000]);
  });

  it('шаг ведёт туда, где охотник будет к следующему своему событию', () => {
    expect(marchesOf(cues(walk)).map((cue) => [cue.y, cue.duration])).toEqual([
      [4.49, 500],
      [3.49, 500],
      [-0.01, 1000],
    ]);
  });

  it('погиб сразу после входа в клетку — спрайт не проскакивает её целиком', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
      { type: 'move', at: 1000, id: 'h1', from: 5, to: 4, y: 4.49 },
      { type: 'kill', at: 1050, id: 'h1', column: 1, y: 4.44 },
      { type: 'end', at: 1100, reason: 'cleared' },
    ]);
    const last = marchesOf(list).at(-1);
    expect(last).toMatchObject({ at: 1000, y: 4.44, duration: 50 });
  });

  it('если дальше у охотника ничего нет — он стоит, а не убегает', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
      { type: 'end', at: 500, reason: 'timeout' },
    ]);
    expect(marchesOf(list)).toEqual([]);
  });

  it('шаги разных охотников не путаются', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 0 },
      { type: 'spawn', at: 0, id: 'h2', kind: 'hunter', column: 1 },
      { type: 'move', at: 300, id: 'h1', from: 5, to: 4, y: 4.49 },
      { type: 'move', at: 900, id: 'h2', from: 5, to: 4, y: 4.49 },
      { type: 'end', at: 1500, reason: 'cleared' },
    ]);
    const first = marchesOf(list).filter((cue) => cue.at === 0);
    expect(first.map((cue) => [cue.id, cue.duration])).toEqual([
      ['h1', 300],
      ['h2', 900],
    ]);
  });
});

describe('туман', () => {
  const walk: NightEvent[] = [
    { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
    { type: 'move', at: 500, id: 'h1', from: 5, to: 4, y: 4.49 },
    { type: 'pace', at: 700, id: 'h1', y: 4.1, factor: 0.46 },
    { type: 'pace', at: 1700, id: 'h1', y: 3.6, factor: 1 },
    { type: 'move', at: 1800, id: 'h1', from: 4, to: 3, y: 3.49 },
    { type: 'end', at: 1900, reason: 'cleared' },
  ];

  it('вход в полосу тумана и выход — свои шаги: замедление видно там, где оно есть', () => {
    const marches = cues(walk).flatMap((cue) => (cue.type === 'march' ? [cue] : []));
    expect(marches.map((cue) => [cue.at, cue.y, cue.duration])).toEqual([
      [0, 4.49, 500],
      [500, 4.1, 200],
      [700, 3.6, 1000],
      [1700, 3.49, 100],
    ]);
  });

  it('сцене — метка «в тумане» и «вышел»', () => {
    const paces = cues(walk).flatMap((cue) => (cue.type === 'pace' ? [cue] : []));
    expect(paces).toEqual([
      { type: 'pace', at: 700, id: 'h1', slowed: true },
      { type: 'pace', at: 1700, id: 'h1', slowed: false },
    ]);
  });
});

describe('стрельба', () => {
  const fight: NightEvent[] = [
    { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
    { type: 'shot', at: 200, from: { x: 1, y: 3 }, targets: ['h1'], damage: 5 },
    { type: 'hit', at: 200, id: 'h1', amount: 5, hpLeft: 5 },
    { type: 'shot', at: 1200, from: { x: 1, y: 3 }, targets: ['h1'], damage: 5 },
    { type: 'hit', at: 1200, id: 'h1', amount: 5, hpLeft: 0 },
    { type: 'kill', at: 1200, id: 'h1', column: 1, y: 3.2 },
    { type: 'end', at: 1250, reason: 'cleared' },
  ];

  it('каждый выстрел — своя подсказка с местом постройки', () => {
    const shots = fight.length > 0 ? cues(fight).filter((cue) => cue.type === 'shot') : [];
    expect(shots).toHaveLength(2);
    expect(shots[0]?.type === 'shot' ? shots[0].from : null).toEqual({ x: 1, y: 3 });
  });

  it('залп по нескольким целям несёт их всех', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
      { type: 'spawn', at: 0, id: 'h2', kind: 'hunter', column: 1 },
      { type: 'shot', at: 100, from: { x: 1, y: 3 }, targets: ['h1', 'h2'], damage: 3 },
      { type: 'end', at: 200, reason: 'cleared' },
    ]);
    const shot = list.find((cue) => cue.type === 'shot');
    expect(shot?.type === 'shot' ? shot.targets : []).toEqual(['h1', 'h2']);
  });

  it('попадание даёт цифру урона, привязанную к охотнику', () => {
    const damage = cues(fight).filter((cue) => cue.type === 'damage');
    expect(damage).toHaveLength(2);
    expect(damage[0]).toMatchObject({ type: 'damage', id: 'h1', amount: 5 });
  });

  it('смерть — отдельная подсказка', () => {
    expect(cues(fight).filter((cue) => cue.type === 'death')).toHaveLength(1);
  });
});

describe('прорыв к воротам', () => {
  it('несёт урон цитадели', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 4 },
      { type: 'leak', at: 900, id: 'h1', column: 4, damage: 7, heartsLeft: 23, y: -0.01 },
      { type: 'end', at: 950, reason: 'cleared' },
    ]);
    const leak = list.find((cue) => cue.type === 'leak');
    expect(leak).toMatchObject({ type: 'leak', id: 'h1', damage: 7, heartsLeft: 23 });
  });
});

describe('порядок и время', () => {
  it('подсказки идут по неубывающему времени', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
      { type: 'move', at: 400, id: 'h1', from: 5, to: 4, y: 4.49 },
      { type: 'shot', at: 500, from: { x: 1, y: 3 }, targets: ['h1'], damage: 5 },
      { type: 'hit', at: 500, id: 'h1', amount: 5, hpLeft: 5 },
      { type: 'kill', at: 900, id: 'h1', column: 1, y: 3.2 },
      { type: 'end', at: 950, reason: 'cleared' },
    ]);
    const times = list.map((cue) => cue.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('служебные события в подсказки не попадают', () => {
    const list = cues([
      { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
      { type: 'hit', at: 100, id: 'h1', amount: 2, hpLeft: 8 },
      { type: 'end', at: 200, reason: 'cleared' },
    ]);
    expect(types(list)).toEqual(['spawn', 'damage', 'end']);
  });
});

describe('длительность показа', () => {
  const list = cues([
    { type: 'spawn', at: 0, id: 'h1', kind: 'hunter', column: 1 },
    { type: 'end', at: 8000, reason: 'cleared' },
  ]);

  it('равна времени последнего события', () => {
    expect(battleDuration(list, 1)).toBe(8000);
  });

  it('на двойной скорости вдвое короче', () => {
    expect(battleDuration(list, 2)).toBe(4000);
  });

  it('без событий — нисколько', () => {
    expect(battleDuration([], 1)).toBe(0);
  });
});

describe('покраснение от попадания', () => {
  it('начинается и кончается своим цветом', () => {
    expect(hitFlashTint(0)).toBe(0xffffff);
    expect(hitFlashTint(1)).toBe(0xffffff);
  });

  it('на середине — красный: зелёный и синий проседают до 144', () => {
    expect(hitFlashTint(0.5)).toBe(0xff9090);
  });

  it('ложится поверх своего цвета врага', () => {
    // Красный канал не трогаем, зелёный и синий — в той же доле.
    expect(hitFlashTint(0.5, 0x808080)).toBe(0x804848);
  });

  it('за пределами 0…1 — как на краях', () => {
    expect(hitFlashTint(-1)).toBe(0xffffff);
    expect(hitFlashTint(2)).toBe(0xffffff);
  });

  it('длится 10 тиков оригинала', () => {
    expect(HIT_FLASH_MS).toBe(167);
  });
});

describe('вспышка попадания', () => {
  it('знает, откуда стреляли', () => {
    const list = cues([
      { type: 'hit', at: 10, id: 'h1', amount: 3, hpLeft: 3, from: { x: 2, y: 4 } },
      { type: 'hit', at: 20, id: 'h1', amount: 3, hpLeft: 0 },
      { type: 'end', at: 30, reason: 'cleared' },
    ]);
    expect(list[0]).toMatchObject({ type: 'damage', from: { x: 2, y: 4 } });
    expect(list[1]).not.toHaveProperty('from');
  });
});
