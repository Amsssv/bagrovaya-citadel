import { describe, expect, it } from 'vitest';

import { boardFrom } from '@/entities/board/__testing__/boardFrom';
import type { BuildingBook, BuildingSpec, TierStats } from '@/entities/building';
import { createCitadel, createNests } from '@/entities/citadel';
import type { EnemyBook } from '@/entities/enemy';
import { createInventory } from '@/entities/item';
import { EMPTY_STATS, createPurse } from '@/entities/player';
import { createRng } from '@/shared/lib/rng';

import { chooseMove, playRun } from './bot';
import { ADEPT, NOVICE } from './botProfile';
import type { RunOptions, RunState } from './run';
import { stepInTwilight } from './run';
import type { PlayerMove } from './twilight';

const sameTiers = (stats: TierStats): BuildingSpec['tiers'] => ({
  raw: stats,
  bone: stats,
  obsidian: stats,
  crimson: stats,
});

const spec = (pattern: BuildingSpec['pattern'], stats: TierStats): BuildingSpec => ({
  pattern,
  targets: 'one',
  aroundShape: 'chebyshev',
  defaultFacing: 'down',
  blockedByBuildings: false,
  verified: true,
  tiers: sameTiers(stats),
});

const NOTHING: TierStats = { damage: 0, shotsPerSecond: 0, range: 0, slowFactor: 0 };

const BUILDINGS: BuildingBook = {
  gargoyle: spec('around', { damage: 4, shotsPerSecond: 1, range: 1, slowFactor: 0 }),
  vine: spec('single', NOTHING),
  mortar: spec('beam', NOTHING),
  fogveil: spec('none', NOTHING),
};

const ENEMIES: EnemyBook = {
  hunter: { hp: 12, speed: 0.9, citadelDamage: 3, verified: true },
};

const WEIGHTS = { night: 100, kill: 2, merge: 10, crimsonMerge: 50, potion: 5, boss: 0 };

function options(seed = 1): RunOptions {
  const rng = createRng(seed);
  const waveRng = rng.fork('wave');
  return {
    rng: rng.fork('refill'),
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    cascadesEnabled: true,
    costs: { swap: 1, drop: 1, open: 1, item: 0, nest: 1 },
    potionSwaps: { raw: 4, bone: 12, obsidian: 70, crimson: 400 },
    longMatchFrom: 4,
    swapsPerNight: 5,
    enemies: ENEMIES,
    buildings: BUILDINGS,
    tickMs: 50,
    maxSeconds: 30,
    waveFor: (night) => ({
      spawns: Array.from({ length: 1 + Math.floor(night / 2) }, (_, index) => ({
        id: `n${String(night)}-${String(index)}`,
        kind: 'hunter',
        column: waveRng.int(0, 6),
        atSecond: index * 1.5,
      })),
    }),
  };
}

function freshState(seed = 1, swaps = 25): RunState {
  const rng = createRng(seed);
  return {
    board: (() => {
      const board = boardFrom(`
        s t a f b s
        t a f b s t
        a f b s t a
        f b s t a f
        b s t a f b
        s t a f b s
      `);
      return board;
    })(),
    citadel: createCitadel(30, 30),
    purse: createPurse(swaps),
    inventory: createInventory(),
    nests: createNests([]),
    night: 1,
    stats: EMPTY_STATS,
    // Сид нужен только чтобы состояние было различимым между тестами.
    ...(rng.next() < 2 ? {} : {}),
  };
}

describe('выбор хода', () => {
  it('умелый предпочитает ход, который что-то замыкает', () => {
    const ready: RunState = {
      ...freshState(),
      board: boardFrom(`
        s s t s b s
        t a f b s t
        a f b s t a
        f b s t a f
        b s t a f b
        s t a f b s
      `),
    };
    const move = chooseMove(ready, options(), ADEPT, createRng(1).fork('bot'));
    expect(move?.type).toBe('swap');

    // Проверяем не конкретные клетки, а то, ради чего ход выбран: он
    // действительно ставит постройку.
    const applied = stepInTwilight(ready, move as PlayerMove, options());
    expect(applied.step.move.spawned.length).toBeGreaterThan(0);
  });

  it('новичок ходит наугад и на ту же доску отвечает иначе', () => {
    const ready: RunState = {
      ...freshState(),
      board: boardFrom(`
        s s t s b s
        t a f b s t
        a f b s t a
        f b s t a f
        b s t a f b
        s t a f b s
      `),
    };
    const clever = chooseMove(ready, options(), ADEPT, createRng(1).fork('bot'));
    const blind = chooseMove(ready, options(), NOVICE, createRng(1).fork('bot'));
    expect(blind).not.toEqual(clever);
  });

  it('на исходе запаса идёт вскрывать потир', () => {
    const poor: RunState = {
      ...freshState(1, 2),
      board: boardFrom(`
        P t a f b s
        t a f b s t
        a f b s t a
        f b s t a f
        b s t a f b
        s t a f b s
      `),
    };
    expect(chooseMove(poor, options(), ADEPT, createRng(1).fork('bot'))).toEqual({
      type: 'open',
      at: { x: 0, y: 0 },
    });
  });

  it('на пустом кошельке потир не вскрыть — ищет обычный ход', () => {
    const broke: RunState = {
      ...freshState(1, 0),
      board: boardFrom(`
        P t a f b s
        t a f b s t
        a f b s t a
        f b s t a f
        b s t a f b
        s t a f b s
      `),
    };
    expect(chooseMove(broke, options(), ADEPT, createRng(1).fork('bot'))?.type).toBe('swap');
  });

  it('когда ходить некуда, возвращает null', () => {
    const single: RunState = { ...freshState(), board: boardFrom('s') };
    expect(chooseMove(single, options(), ADEPT, createRng(1).fork('bot'))).toBeNull();
  });
});

describe('башни замка', () => {
  const towers = createNests([
    { id: 'left', from: { x: 0, y: 0 }, direction: 'up', accepts: ['gargoyle'] },
  ]);
  const armed: RunState = {
    ...freshState(),
    nests: towers,
    board: boardFrom(`
      G t a f b s
      t a f b s t
      a f b s t a
      f b s t a f
      b s t a f b
      s t a f b s
    `),
  };

  it('умелый ставит горгулью в башню, как только может', () => {
    expect(chooseMove(armed, options(), ADEPT, createRng(1).fork('bot'))).toEqual({
      type: 'nest',
      from: { x: 0, y: 0 },
      direction: 'up',
    });
  });

  it('тройку камня под башней ставит в угол: горгулья родится там, откуда её поднимают', () => {
    // Камень справа от угла тянут в угол — тройка встаёт на (0, 0).
    const cornered: RunState = {
      ...armed,
      board: boardFrom(`
        t s s f b s
        s a f b s t
        a f b s t a
        f b s t a f
        b s t a f b
        s t a f b s
      `),
    };
    expect(chooseMove(cornered, options(), ADEPT, createRng(1).fork('bot'))).toEqual({
      type: 'swap',
      from: { x: 0, y: 1 },
      to: { x: 0, y: 0 },
    });
  });

  it('башня уже с горгульей той же ступени — ставить нечего, бот ходит свапом', () => {
    const full: RunState = {
      ...armed,
      nests: {
        ...towers,
        occupied: {
          left: { cell: { kind: 'building', building: 'gargoyle', tier: 'raw' }, facing: 'down' },
        },
      },
    };
    expect(chooseMove(full, options(), ADEPT, createRng(1).fork('bot'))?.type).toBe('swap');
  });

  it('новичок про башни не знает', () => {
    expect(chooseMove(armed, options(), NOVICE, createRng(1).fork('bot'))?.type).not.toBe('nest');
  });

  it('ход в башню убирает горгулью с поля и ставит её в стену', () => {
    const move = chooseMove(armed, options(), ADEPT, createRng(1).fork('bot'));
    if (move === null) throw new Error('хода нет');
    const after = stepInTwilight(armed, move, options()).run;
    expect(after.nests.occupied['left']?.cell).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'raw',
    });
    expect(after.board.cells[0]?.kind).toBe('tile');
    expect(after.purse.swaps).toBe(armed.purse.swaps - 1);
  });
});

describe('забег бота', () => {
  const setup = (profileSeed = 1) => ({
    run: freshState(),
    options: options(profileSeed),
    profile: ADEPT,
    rng: createRng(profileSeed).fork('bot'),
    weights: WEIGHTS,
    maxNights: 30,
  });

  it('доигрывает до падения цитадели', () => {
    const result = playRun(setup());
    expect(result.outcome).toBe('fallen');
    expect(result.nights).toBeGreaterThan(0);
  });

  it('копит счётчики и считает по ним очки', () => {
    const result = playRun(setup());
    expect(result.stats.nights).toBe(result.nights);
    expect(result.score).toBeGreaterThan(0);
  });

  it('суммирует длительность боёв', () => {
    expect(playRun(setup()).battleMs).toBeGreaterThan(0);
  });

  it('упирается в предел прогона, если цитадель не падает', () => {
    const tough = {
      ...setup(),
      run: { ...freshState(), citadel: createCitadel(30, 30) },
      options: { ...options(1), waveFor: () => ({ spawns: [] }) },
      maxNights: 5,
    };
    const result = playRun(tough);
    expect(result.outcome).toBe('capped');
    expect(result.nights).toBe(5);
  });

  it('поле, где ходить нечем, не вешает забег', () => {
    const stuck = {
      ...setup(),
      run: { ...freshState(), board: boardFrom('s') },
      options: { ...options(1), waveFor: () => ({ spawns: [] }) },
      maxNights: 3,
    };
    const result = playRun(stuck);
    expect(result.outcome).toBe('capped');
    expect(result.nights).toBe(3);
  });

  it('один сид — один и тот же забег', () => {
    expect(playRun(setup(7))).toEqual(playRun(setup(7)));
  });

  it('умелый в среднем живёт дольше новичка', () => {
    // На одном сиде это ничего не значит: удачный случайный ход бывает лучше
    // расчётливого. Разница видна только на многих забегах — ровно так её и
    // меряет массовый прогон.
    const mean = (profile: typeof ADEPT): number => {
      let total = 0;
      for (let seed = 1; seed <= 20; seed++) {
        total += playRun({
          ...setup(seed),
          profile,
          rng: createRng(seed).fork('bot'),
        }).nights;
      }
      return total / 20;
    };
    expect(mean(ADEPT)).toBeGreaterThan(mean(NOVICE));
    // Сорок полных забегов: под покрытием это около пяти секунд — ровно
    // стандартный предел vitest, поэтому свой запас.
  }, 30_000);
});
