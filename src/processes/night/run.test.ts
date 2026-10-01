import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from '@/entities/board/__testing__/boardFrom';
import type { BuildingBook, BuildingSpec, TierStats } from '@/entities/building';
import { createCitadel, createNests } from '@/entities/citadel';
import type { EnemyBook } from '@/entities/enemy';
import { createInventory } from '@/entities/item';
import { createPurse } from '@/entities/player';
import type { WaveConfig } from '@/entities/wave';
import { createRng } from '@/shared/lib/rng';

import {
  canRepair,
  defenseOf,
  giveUp,
  isRunOver,
  playInTwilight,
  repairCitadel,
  runDawn,
  startRun,
} from './run';
import type { RunOptions, RunState } from './run';

const sameTiers = (stats: TierStats): BuildingSpec['tiers'] => ({
  raw: stats,
  bone: stats,
  obsidian: stats,
  crimson: stats,
});

const silent = (pattern: BuildingSpec['pattern']): BuildingSpec => ({
  pattern,
  targets: 'one',
  aroundShape: 'chebyshev',
  defaultFacing: 'down',
  blockedByBuildings: false,
  verified: true,
  tiers: sameTiers({ damage: 0, shotsPerSecond: 0, range: 0, slowFactor: 0 }),
});

const BUILDINGS: BuildingBook = {
  gargoyle: {
    ...silent('around'),
    tiers: sameTiers({ damage: 5, shotsPerSecond: 1, range: 1, slowFactor: 0 }),
  },
  vine: silent('single'),
  mortar: silent('beam'),
  fogveil: silent('none'),
};

const ENEMIES: EnemyBook = {
  hunter: { hp: 8, speed: 2, citadelDamage: 3, verified: true },
};

const BOARD = boardFrom(`
  s t a f b
  t a f b s
  a f b s t
  f b s t a
`);

function options(waves: Record<number, WaveConfig> = {}, seed = 1): RunOptions {
  return {
    rng: createRng(seed).fork('refill'),
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    costs: { swap: 1, drop: 1, open: 1, item: 0, nest: 1 },
    potionSwaps: { raw: 3, bone: 12, obsidian: 70, crimson: 400 },
    longMatchFrom: 4,
    swapsPerNight: 5,
    enemies: ENEMIES,
    buildings: BUILDINGS,
    tickMs: 50,
    maxSeconds: 30,
    waveFor: (night) => waves[night] ?? { spawns: [] },
  };
}

const start = (hearts = 30, swaps = 20): RunState =>
  startRun({
    board: BOARD,
    citadel: createCitadel(hearts, 30),
    purse: createPurse(swaps),
    inventory: createInventory(),
    nests: createNests([]),
  });

const oneHunter = (column: number): WaveConfig => ({
  spawns: [{ id: 'h1', kind: 'hunter', column, atSecond: 0 }],
});

describe('начало забега', () => {
  it('забег начинается с первой ночи', () => {
    expect(start().night).toBe(1);
  });

  it('запас и сердца берутся как есть', () => {
    const state = start(25, 14);
    expect(state.citadel.hearts).toBe(25);
    expect(state.purse.swaps).toBe(14);
  });

  it('забег не окончен, пока цитадель стоит', () => {
    expect(isRunOver(start())).toBe(false);
  });
});

describe('Рассвет и переход к следующей ночи', () => {
  it('счётчик ночей растёт', () => {
    const report = runDawn(start(), options());
    expect(report.night).toBe(1);
    expect(report.after.night).toBe(2);
  });

  it('пустая ночь проходит без потерь', () => {
    const report = runDawn(start(), options());
    expect(report.dawn.outcome).toBe('cleared');
    expect(report.after.citadel.hearts).toBe(30);
  });

  it('прорвавшийся охотник снимает сердца', () => {
    const report = runDawn(start(), options({ 1: oneHunter(2) }));
    expect(report.dawn.leaked).toBe(1);
    expect(report.after.citadel.hearts).toBe(27);
  });

  it('оборона не пускает — сердца целы', () => {
    const defended = boardFrom(`
      s t a f b
      t a f b s
      a f G s t
      f b s t a
    `);
    const state: RunState = { ...start(), board: defended };
    const report = runDawn(state, options({ 1: oneHunter(2) }));
    expect(report.dawn.killed).toBe(1);
    expect(report.after.citadel.hearts).toBe(30);
  });

  it('поле за Рассвет не меняется: постройки не гибнут', () => {
    const report = runDawn(start(), options({ 1: oneHunter(2) }));
    expect(pictureOf(report.after.board)).toBe(pictureOf(BOARD));
  });

  it('после боя ночная норма крови наливается заново', () => {
    const report = runDawn(start(30, 0), options({ 1: oneHunter(2) }));
    expect(report.after.purse.swaps).toBe(5);
    expect(report.after.purse.granted).toBe(5);
  });

  it('норма доливает до пяти, а не сверху: лишней крови рассвет не даёт', () => {
    expect(runDawn(start(30, 2), options()).after.purse.swaps).toBe(5);
    expect(runDawn(start(30, 14), options()).after.purse.swaps).toBe(14);
  });

  it('волна берётся по номеру ночи', () => {
    const state = runDawn(start(), options({ 2: oneHunter(0) })).after;
    const second = runDawn(state, options({ 2: oneHunter(0) }));
    expect(second.wave.spawns).toHaveLength(1);
    expect(second.night).toBe(2);
  });

  it('исходное состояние не меняется', () => {
    const before = start();
    runDawn(before, options({ 1: oneHunter(2) }));
    expect(before.night).toBe(1);
    expect(before.citadel.hearts).toBe(30);
  });
});

describe('забег кончается, когда падает цитадель', () => {
  it('добивающая ночь роняет цитадель', () => {
    const report = runDawn(start(3), options({ 1: oneHunter(2) }));
    expect(report.after.citadel.hearts).toBe(0);
    expect(isRunOver(report.after)).toBe(true);
  });

  it('несколько ночей подряд копят урон', () => {
    const waves = { 1: oneHunter(0), 2: oneHunter(1), 3: oneHunter(2) };
    let state = start(30);
    for (let i = 0; i < 3; i++) state = runDawn(state, options(waves)).after;

    expect(state.citadel.hearts).toBe(21);
    expect(state.night).toBe(4);
  });
});

describe('ходы в Сумерках внутри забега', () => {
  it('ход тратит свап и меняет поле', () => {
    const next = playInTwilight(
      start(30, 10),
      { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      options(),
    );
    expect(next.purse.swaps).toBe(9);
    expect(pictureOf(next.board)).not.toBe(pictureOf(BOARD));
  });

  it('ночь и цитадель ход не трогает', () => {
    const next = playInTwilight(
      start(25, 10),
      { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      options(),
    );
    expect(next.night).toBe(1);
    expect(next.citadel.hearts).toBe(25);
  });

  it('слияния и потраченные свапы попадают в счётчики забега', () => {
    const withGargoyles = boardFrom(`
      G G s t b
      t a G f s
      a f b s t
      f b s t a
    `);
    const next = playInTwilight(
      { ...start(30, 10), board: withGargoyles },
      { type: 'swap', from: { x: 2, y: 1 }, to: { x: 2, y: 0 } },
      options(),
    );
    expect(next.stats.merges).toBe(1);
    expect(next.stats.crimsonMerges).toBe(0);
    expect(next.stats.swapsSpent).toBe(1);
  });

  it('ночь копится в счётчиках', () => {
    const after = runDawn(start(), options({ 1: oneHunter(2) })).after;
    expect(after.stats.nights).toBe(1);
    expect(after.stats.enemiesLeaked).toBe(1);
  });

  it('без свапов ходить нечем', () => {
    expect(() =>
      playInTwilight(
        start(30, 0),
        { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        options(),
      ),
    ).toThrow();
  });
});

describe('забег целиком', () => {
  it('ходы и ночи складываются в непрерывный забег', () => {
    const waves = { 1: oneHunter(0), 2: oneHunter(1) };
    let state = start(30, 10);

    state = playInTwilight(
      state,
      { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      options(waves),
    );
    state = runDawn(state, options(waves)).after;
    state = playInTwilight(
      state,
      { type: 'swap', from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
      options(waves),
    );
    state = runDawn(state, options(waves)).after;

    expect(state.night).toBe(3);
    expect(state.purse.swaps).toBe(8);
    expect(state.citadel.hearts).toBe(24);
  });

  it('два одинаковых забега сходятся до сердца', () => {
    const waves = { 1: oneHunter(0), 2: oneHunter(1) };
    const play = (): RunState => {
      let state = start(30, 10);
      for (let night = 0; night < 2; night++) state = runDawn(state, options(waves)).after;
      return state;
    };
    expect(play()).toEqual(play());
  });
});

describe('ремонт павшей цитадели — раз за забег, как в оригинале', () => {
  const fallen = (state: RunState): RunState => ({
    ...state,
    citadel: { ...state.citadel, hearts: 0 },
  });

  it('павшую можно починить: сердца — стартовые, забег продолжается', () => {
    const down = fallen(start());
    expect(isRunOver(down)).toBe(true);
    expect(canRepair(down)).toBe(true);

    const repaired = repairCitadel(down, 5);
    expect(repaired.citadel.hearts).toBe(5);
    expect(isRunOver(repaired)).toBe(false);
    expect(repaired.repaired).toBe(true);
  });

  it('второй раз — нельзя: второе падение — конец', () => {
    const once = repairCitadel(fallen(start()), 5);
    const again = fallen(once);
    expect(canRepair(again)).toBe(false);
    expect(() => repairCitadel(again, 5)).toThrow();
  });

  it('стоящую чинить нечего', () => {
    expect(canRepair(start())).toBe(false);
  });
});

describe('сдаться — как «Give Up» в оригинале', () => {
  it('забег кончается сразу, поле и ночь остаются как были', () => {
    const state = start();
    const surrendered = giveUp(state);
    expect(isRunOver(surrendered)).toBe(true);
    expect(surrendered.night).toBe(state.night);
    expect(surrendered.board).toBe(state.board);
  });

  it('после сдачи ремонт за ролик не предлагается', () => {
    expect(canRepair(giveUp(start()))).toBe(false);
  });
});

describe('оборона ночи — для очков', () => {
  it('рассвет записывает постройки поля по ступеням', () => {
    const board = boardFrom(`
      G t a
      t G s
      a t s
    `);
    const tally = defenseOf(board);
    expect(tally.raw + tally.bone + tally.obsidian + tally.crimson).toBe(2);
  });
});
