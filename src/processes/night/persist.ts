import { createBoard } from '@/entities/board';
import type { Board } from '@/entities/board';
import type { CitadelLevelId, Nests } from '@/entities/citadel';
import { createCitadel } from '@/entities/citadel';
import { createInventory } from '@/entities/item';
import type { RunSave, SaveData } from '@/entities/player';
import { EMPTY_SAVE, EMPTY_STATS, createPurse } from '@/entities/player';
import type { Rng, RngSnapshot } from '@/shared/lib/rng';
import { restoreRng } from '@/shared/lib/rng';

import type { RunState } from './run';

/**
 * Перевод забега в сохранение и обратно.
 *
 * Поток досыпки сохраняется вместе с полем: без него загруженный забег
 * разошёлся бы с тем, который сохраняли, — первая же досыпка выдала бы другие
 * плитки.
 *
 * Раскладка гнёзд (башен замка) в сейв не попадает — она в конфиге; в сейве
 * только то, что в них стоит.
 *
 * Цитадель-уровень (§12) приходит отдельным параметром, а не из `RunState`:
 * внутри забега она не меняется и на расчёт ночи не влияет — её дело в том,
 * какими параметрами забег был заведён.
 */
export function runToSave(
  run: RunState,
  rng: Rng,
  level: CitadelLevelId,
  previous: SaveData = EMPTY_SAVE,
): SaveData {
  return {
    ...previous,
    version: EMPTY_SAVE.version,
    run: {
      level,
      night: run.night,
      hearts: run.citadel.hearts,
      maxHearts: run.citadel.maxHearts,
      purse: {
        swaps: run.purse.swaps,
        initial: run.purse.initial,
        spent: run.purse.spent,
        granted: run.purse.granted,
      },
      inventory: { ...run.inventory.items },
      board: { width: run.board.width, height: run.board.height, cells: [...run.board.cells] },
      rng: rng.snapshot(),
      stats: { ...run.stats },
      nests: { ...run.nests.occupied },
      repaired: run.repaired === true,
      dayOff: run.dayOff === true,
      dayOffTaken: run.dayOffTaken === true,
    },
  };
}

export interface RestoredRun {
  readonly run: RunState;
  readonly rng: Rng;
}

/**
 * Собрать забег обратно. Раскладка гнёзд — из конфига, содержимое — из сейва;
 * то, что лежит в гнезде, которого в конфиге больше нет, отбрасывается.
 */
export function saveToRun(saved: RunSave, nests: Nests): RestoredRun {
  const known = new Set(nests.slots.map((slot) => slot.id));
  const occupied = Object.fromEntries(Object.entries(saved.nests).filter(([id]) => known.has(id)));
  const board: Board = {
    width: saved.board.width,
    height: saved.board.height,
    cells: saved.board.cells,
  };

  return {
    run: {
      board,
      citadel: createCitadel(saved.hearts, saved.maxHearts),
      purse: {
        swaps: saved.purse.swaps,
        initial: saved.purse.initial,
        spent: saved.purse.spent,
        granted: saved.purse.granted,
      },
      inventory: createInventory(saved.inventory),
      nests: { ...nests, occupied },
      night: saved.night,
      stats: saved.stats,
      repaired: saved.repaired,
      ...(saved.dayOff && { dayOff: true }),
      ...(saved.dayOffTaken && { dayOffTaken: true }),
    },
    rng: restoreRng(saved.rng as RngSnapshot),
  };
}

export interface FreshRunOptions {
  readonly rng: Rng;
  readonly width: number;
  readonly height: number;
  readonly resources: Parameters<typeof createBoard>[1]['resources'];
  readonly withoutMatches: boolean;
  readonly hearts: number;
  readonly maxHearts: number;
  readonly swaps: number;
  readonly nests: Nests;
  /** Предметы, перенесённые с прошлых забегов (§11). */
  readonly carried: Readonly<Record<string, number>>;
}

/** Новый забег: поле раздаётся заново, предметы переносятся с прошлых (§11). */
export function freshRun(options: FreshRunOptions): RunState {
  return {
    board: createBoard(options.rng.fork('board'), {
      width: options.width,
      height: options.height,
      resources: options.resources,
      withoutMatches: options.withoutMatches,
    }),
    citadel: createCitadel(options.hearts, options.maxHearts),
    purse: createPurse(options.swaps),
    inventory: createInventory(options.carried),
    nests: options.nests,
    night: 1,
    stats: EMPTY_STATS,
  };
}
