import { describe, expect, it } from 'vitest';

import type { Board } from '@/entities/board';
import { building, withCells } from '@/entities/board';
import { boardFrom } from '@/entities/board/__testing__/boardFrom';
import { createCitadel, createNests } from '@/entities/citadel';
import { createInventory } from '@/entities/item';
import { EMPTY_STATS, createPurse } from '@/entities/player';
import { BOARD_CONFIG } from '@/shared/config/board';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { ECONOMY_CONFIG, POTION_SWAPS } from '@/shared/config/economy';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { NIGHT_CONFIG } from '@/shared/config/night';
import { BATTLE_CONFIG } from '@/shared/config/waves';
import { createRng } from '@/shared/lib/rng';

import type { RunOptions, RunState } from './run';
import {
  STRATEGIST,
  candidateMoves,
  chooseStrategistMove,
  columnDefense,
  evaluate,
  readyMoves,
} from './strategist';

function options(): RunOptions {
  return {
    rng: createRng(1),
    resources: BOARD_CONFIG.resources,
    cascadesEnabled: BOARD_CONFIG.cascadesEnabled,
    costs: ECONOMY_CONFIG.costs,
    potionSwaps: POTION_SWAPS,
    longMatchFrom: ECONOMY_CONFIG.longMatchFrom,
    longMerge: ECONOMY_CONFIG.longMerge,
    comboFrom: ECONOMY_CONFIG.comboFrom,
    swapsPerNight: ECONOMY_CONFIG.swapsPerNight,
    enemies: ENEMY_BOOK,
    buildings: BUILDING_BOOK,
    tickMs: NIGHT_CONFIG.tickMs,
    maxSeconds: NIGHT_CONFIG.maxSeconds,
    turretRange: CITADEL_CONFIG.turretRange,
    shootDepth: BATTLE_CONFIG.shootDepth,
    waveFor: () => ({ spawns: [] }),
  };
}

function state(board: Board, swaps = 5): RunState {
  return {
    board,
    citadel: createCitadel(5, 36),
    purse: createPurse(swaps),
    inventory: createInventory(),
    nests: createNests(CITADEL_CONFIG.nests),
    night: 1,
    stats: EMPTY_STATS,
  };
}

// Троек нет, и ни один свап их не даёт, кроме задуманного.
const PLAIN = boardFrom(`
  s t a f b s
  t a f b s t
  a f b s t a
  f b s t a f
  b s t a f b
  s t a f b s
`);

describe('стратег: оборона по столбцам', () => {
  it('на голом поле обороны нет', () => {
    expect(columnDefense(state(PLAIN), options())).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('без простреливаемых рядов под полем — только само поле', () => {
    const board = withCells(PLAIN, [[{ x: 1, y: 1 }, building('vine', 'raw')]]);
    const { shootDepth: _depth, ...flat } = options();
    const deep = columnDefense(state(board), options())[1] ?? 0;
    expect(columnDefense(state(board), flat)[1]).toBeLessThan(deep);
  });

  it('горгулья держит свой столбец и соседние, но не дальние', () => {
    const board = withCells(PLAIN, [[{ x: 2, y: 2 }, building('gargoyle', 'raw')]]);
    const columns = columnDefense(state(board), options());
    expect(columns[1]).toBeGreaterThan(0);
    expect(columns[2]).toBeGreaterThan(0);
    expect(columns[3]).toBeGreaterThan(0);
    expect(columns[0]).toBe(0);
    expect(columns[5]).toBe(0);
  });

  it('завеса в зоне горгульи растягивает время — столбец держит дольше', () => {
    const gargoyle = withCells(PLAIN, [[{ x: 2, y: 2 }, building('gargoyle', 'raw')]]);
    const veiled = withCells(gargoyle, [[{ x: 2, y: 3 }, building('fogveil', 'raw')]]);
    const plain = columnDefense(state(gargoyle), options())[2] ?? 0;
    expect(columnDefense(state(veiled), options())[2]).toBeGreaterThan(plain);
  });

  it('горгулья в башне замка бьёт по верхним рядам', () => {
    const run = state(PLAIN);
    const armed: RunState = {
      ...run,
      nests: {
        ...run.nests,
        occupied: { left: { cell: building('gargoyle', 'raw'), facing: 'down' } },
      },
    };
    expect(columnDefense(armed, options())[0]).toBeGreaterThan(0);
  });
});

describe('стратег: оценка поля', () => {
  it('постройка ценнее голого поля, ступень выше — ценнее', () => {
    const at = { x: 2, y: 2 };
    const raw = evaluate(state(withCells(PLAIN, [[at, building('gargoyle', 'raw')]])), options());
    const bone = evaluate(state(withCells(PLAIN, [[at, building('gargoyle', 'bone')]])), options());
    expect(raw).toBeGreaterThan(evaluate(state(PLAIN), options()));
    expect(bone).toBeGreaterThan(raw);
  });

  it('в ночь босса его столбец весит больше', () => {
    const board = withCells(PLAIN, [[{ x: 0, y: 2 }, building('vine', 'raw')]]);
    const run = state(board);
    expect(evaluate(run, options(), STRATEGIST, 0)).toBeGreaterThan(
      evaluate(run, options(), STRATEGIST, 5),
    );
  });

  it('пара одинаковых построек или потиров рядом — заготовка слияния', () => {
    const pair = withCells(PLAIN, [
      [{ x: 1, y: 1 }, building('mortar', 'raw')],
      [{ x: 2, y: 1 }, building('mortar', 'raw')],
      [
        { x: 1, y: 4 },
        { kind: 'potion', tier: 'raw' },
      ],
      [
        { x: 1, y: 5 },
        { kind: 'potion', tier: 'raw' },
      ],
    ]);
    const apart = withCells(PLAIN, [
      [{ x: 1, y: 1 }, building('mortar', 'raw')],
      [{ x: 4, y: 1 }, building('mortar', 'raw')],
      [
        { x: 1, y: 4 },
        { kind: 'potion', tier: 'raw' },
      ],
      [
        { x: 4, y: 5 },
        { kind: 'potion', tier: 'raw' },
      ],
    ]);
    expect(evaluate(state(pair), options())).toBeGreaterThan(evaluate(state(apart), options()));
  });

  it('потир на поле — кровь про запас', () => {
    const potion = boardFrom(`
      s t a f b s
      t a f b s t
      a f P s t a
      f b s t a f
      b s t a f b
      s t a f b s
    `);
    expect(evaluate(state(potion), options())).toBeGreaterThan(evaluate(state(PLAIN), options()));
  });

  it('заготовки: свап, дающий тройку или слияние, виден заранее', () => {
    const ready = boardFrom(`
      s s t a f b
      t a s b s t
      a f b s t a
      f b s t a f
      b s t a f b
      G G t G f b
    `);
    const { matches, merges } = readyMoves(ready);
    expect(matches).toBeGreaterThan(0);
    expect(merges).toBeGreaterThan(0);
    expect(readyMoves(PLAIN).matches).toBe(0);
  });
});

describe('стратег: выбор хода', () => {
  it('кандидаты — только законные ходы: свапы, потир, башня', () => {
    const board = withCells(PLAIN, [
      [{ x: 0, y: 0 }, building('gargoyle', 'raw')],
      [
        { x: 3, y: 3 },
        { kind: 'potion', tier: 'raw' },
      ],
    ]);
    const moves = candidateMoves(state(board), options());
    expect(moves.some((move) => move.type === 'open')).toBe(true);
    expect(moves.some((move) => move.type === 'nest')).toBe(true);
    expect(moves.some((move) => move.type === 'swap')).toBe(true);
  });

  it('без крови ходить нечем', () => {
    expect(chooseStrategistMove(state(PLAIN, 0), options(), createRng(1))).toBeNull();
  });

  it('последней каплей собирает тройку, а не переставляет плитки', () => {
    const board = boardFrom(`
      s t a f b s
      t a f b s t
      a f b s t a
      f b s t a f
      b s t a f b
      G G b G f s
    `);
    const move = chooseStrategistMove(state(board, 1), options(), createRng(1));
    expect(move).not.toBeNull();
    expect(move?.type).toBe('swap');
  });

  it('с запасом крови досчитывает ход вперёд и тоже находит ход', () => {
    const move = chooseStrategistMove(state(PLAIN, 5), options(), createRng(1), STRATEGIST, 2, 3);
    expect(move).not.toBeNull();
  });
});
