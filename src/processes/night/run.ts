import type { Board } from '@/entities/board';
import type { Citadel } from '@/entities/citadel';
import { createCitadel, isFallen } from '@/entities/citadel';
import type { Nests } from '@/entities/citadel';
import type { EnemyBook } from '@/entities/enemy';
import type { Inventory } from '@/entities/item';
import type { DefenseTally, RunStats, SwapPurse } from '@/entities/player';
import { EMPTY_STATS, addMove, addNight, grantSwaps } from '@/entities/player';
import type { NightResult, WaveConfig } from '@/entities/wave';
import { simulateNight } from '@/entities/wave';
import type { BuildingBook } from '@/entities/building';

import type { PlayerMove, TwilightOptions, TwilightStep } from './twilight';
import { playMove } from './twilight';

/**
 * Забег: последовательность ночей, каждая из двух фаз (§2).
 *
 *   🌙 Сумерки — игрок тратит свапы, строит и перестраивает
 *   ⚔️ Рассвет — охотники идут к цитадели, постройки стреляют сами
 *
 * Между ночами поле остаётся как есть и постройки не гибнут. Кровь (свапы) —
 * ночная норма: Сумерки идут, пока она не кончится, и после боя наливается
 * заново. Забег кончается, когда падает цитадель.
 */
export interface RunState {
  readonly board: Board;
  readonly citadel: Citadel;
  readonly purse: SwapPurse;
  /** Предметы переносятся между забегами (§11), но тратятся внутри него. */
  readonly inventory: Inventory;
  readonly nests: Nests;
  readonly night: number;
  /** Счётчики забега: из них потом считаются очки (§14 #10). */
  readonly stats: RunStats;
  /**
   * Замок уже чинили после падения — как в оригинале, это можно один раз за
   * забег. Не задано — не чинили.
   */
  readonly repaired?: boolean | undefined;
  /**
   * Эта ночь — выходной (день перестановки, `dayOff.ts`): ходы бесплатные,
   * досыпки и врагов нет. Не задано — обычная ночь.
   */
  readonly dayOff?: boolean | undefined;
  /** Выходной в этом забеге уже брали — как в оригинале, он один на забег. */
  readonly dayOffTaken?: boolean | undefined;
}

export interface RunOptions extends TwilightOptions {
  readonly enemies: EnemyBook;
  readonly buildings: BuildingBook;
  readonly tickMs: number;
  readonly maxSeconds: number;
  /** Радиус огня из башни замка. */
  readonly turretRange?: number | undefined;
  /** Скорость снарядов, клеток в секунду. Не задана — попадание сразу. */
  readonly projectileSpeed?: number | undefined;
  /** На сколько клеток ниже поля появляются враги. */
  readonly spawnDepth?: number | undefined;
  /** Сколько рядов под полем простреливается. */
  readonly shootDepth?: number | undefined;
  /** Ночная норма крови: столько наливается после каждого боя. */
  readonly swapsPerNight: number;
  /**
   * Состав волны на эту ночь. Функцией, а не формулой: как волна растёт от ночи
   * к ночи, спека не говорит (§14 #9), и придумывать здесь кривую сложности
   * нельзя. Боевая реализация собирает её по плану из `balance.ts` (`nightWave`).
   */
  readonly waveFor: (night: number) => WaveConfig;
}

export interface NightReport {
  readonly night: number;
  readonly wave: WaveConfig;
  readonly dawn: NightResult;
  readonly before: RunState;
  readonly after: RunState;
}

export function startRun(init: Omit<RunState, 'night' | 'stats'>): RunState {
  return { ...init, night: 1, stats: EMPTY_STATS };
}

/** Забег окончен: цитадель пала. */
export function isRunOver(state: RunState): boolean {
  return isFallen(state.citadel);
}

/** Можно ли ещё починить павшую цитадель — один раз за забег, как в оригинале. */
export function canRepair(state: RunState): boolean {
  return isRunOver(state) && state.repaired !== true;
}

/**
 * Сдаться — как «Give Up» в оригинале: забег кончается сразу, рекорд
 * записывается как обычно. Ремонт за ролик после этого не предлагается:
 * сдавшемуся «последний шанс» не нужен.
 */
export function giveUp(state: RunState): RunState {
  return {
    ...state,
    citadel: { ...state.citadel, hearts: 0 },
    repaired: true,
  };
}

/**
 * Починить павшую цитадель: сердца — до стартовых, враги с поля уходят (бой и
 * так кончился), забег идёт со следующей ночи. Второй раз — нельзя.
 */
export function repairCitadel(state: RunState, hearts: number): RunState {
  if (!canRepair(state)) {
    throw new Error('Чинить нечего: цитадель стоит или её уже чинили в этом забеге');
  }
  return {
    ...state,
    citadel: createCitadel(hearts, state.citadel.maxHearts),
    repaired: true,
  };
}

/**
 * Ход игрока в Сумерках вместе с подробностями: шаги для анимации, цена,
 * выданные свапы. Ночь и цитадель ход не трогает.
 *
 * Ход считается **ровно один раз**: он расходует поток досыпки, и повторный
 * вызов увёл бы поле и анимацию в разные стороны.
 */
export function stepInTwilight(
  state: RunState,
  move: PlayerMove,
  options: RunOptions,
): { run: RunState; step: TwilightStep } {
  const step = playMove(
    { board: state.board, purse: state.purse, inventory: state.inventory, nests: state.nests },
    move,
    options,
  );

  const crimsonMerges = step.move.merges.filter((merge) => merge.into.tier === 'crimson').length;

  return {
    step,
    run: {
      ...state,
      board: step.state.board,
      purse: step.state.purse,
      inventory: step.state.inventory,
      // Гнёзда в ход передали — значит, они и вернулись: ход их не теряет.
      nests: step.state.nests as Nests,
      stats: addMove(state.stats, {
        merges: step.move.merges.length,
        crimsonMerges,
        potionOpened: move.type === 'open',
        swapsSpent: step.cost,
        itemUsed: move.type === 'item',
      }),
    },
  };
}

/** Ход игрока в Сумерках, когда подробности не нужны. */
export function playInTwilight(state: RunState, move: PlayerMove, options: RunOptions): RunState {
  return stepInTwilight(state, move, options).run;
}

/**
 * Рассвет: считаем бой целиком и переходим к следующей ночи.
 *
 * Поле после боя не меняется — охотники проходят сквозь постройки и ничего не
 * ломают (§4). Меняются сердца цитадели, номер ночи и кровь: норма доливается
 * до полной. Доливается, а не прибавляется — рассвет сам крови не дарит.
 */
export function runDawn(state: RunState, options: RunOptions): NightReport {
  const wave = options.waveFor(state.night);

  const dawn = simulateNight(
    { board: state.board, citadel: state.citadel, night: state.night, nests: state.nests },
    wave,
    {
      enemies: options.enemies,
      buildings: options.buildings,
      tickMs: options.tickMs,
      maxSeconds: options.maxSeconds,
      turretRange: options.turretRange,
      projectileSpeed: options.projectileSpeed,
      spawnDepth: options.spawnDepth,
      shootDepth: options.shootDepth,
    },
  );

  return {
    night: state.night,
    wave,
    dawn,
    before: state,
    after: {
      ...state,
      citadel: dawn.citadel,
      purse: grantSwaps(state.purse, Math.max(0, options.swapsPerNight - state.purse.swaps)),
      night: state.night + 1,
      stats: addNight(state.stats, {
        killed: dawn.killed,
        leaked: dawn.leaked,
        bossesKilled: dawn.bossesKilled,
        defense: defenseOf(state.board),
      }),
    },
  };
}

/** Постройки на поле по ступеням — снимок обороны ночи для очков. */
export function defenseOf(board: Board): DefenseTally {
  const tally = { raw: 0, bone: 0, obsidian: 0, crimson: 0 };
  for (const cell of board.cells) if (cell.kind === 'building') tally[cell.tier] += 1;
  return tally;
}
