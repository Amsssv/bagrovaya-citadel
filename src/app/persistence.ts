import type { CitadelLevel, CitadelLevelId } from '@/entities/citadel';
import { DEFAULT_LEVEL_ID, createNests, levelById } from '@/entities/citadel';
import type { SaveData } from '@/entities/player';
import { grantSwaps, isExhausted, loadSave } from '@/entities/player';
import type { RunOptions, RunState } from '@/processes/night';
import { freshRun, saveToRun } from '@/processes/night';
import { createBrowserStorage } from '@/shared/api';
import type { Storage } from '@/shared/api';
import { bossColumn, isBossNight, nightWave } from '@/entities/wave';
import { BOARD_CONFIG } from '@/shared/config/board';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { ECONOMY_CONFIG, POTION_SWAPS } from '@/shared/config/economy';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { LEVELS } from '@/shared/config/levels';
import { NIGHT_CONFIG } from '@/shared/config/night';
import { BATTLE_CONFIG, NIGHT_WAVE_PLAN } from '@/shared/config/waves';
import type { Rng } from '@/shared/lib/rng';
import { createRng } from '@/shared/lib/rng';

/**
 * Подъём игры: прочитать сохранение, собрать забег и потоки случайности.
 *
 * Прогресс лежит на устройстве и не требует регистрации (§13). Битый или
 * отсутствующий сейв не мешает запуску — начинаем новый забег.
 *
 * Цитадель-уровень (§12) выбирается здесь: от неё зависят набор ресурсов и
 * стартовый запас свапов. Забег идёт в одной цитадели; переход в другую —
 * это новый забег, поэтому `fresh`.
 */
export const STORAGE_KEY = 'bagrovaya-citadel';
export const SAVE_INTERVAL_MS = 10_000;

/**
 * Сид нового забега — свой у каждого: иначе все забеги начинались бы с
 * одного поля и одних волн, и поле можно было бы выучить. Внутри забега всё
 * по-прежнему воспроизводимо: сид уходит в сейв вместе с потоком досыпки, от
 * него же считаются волны и столбец босса.
 *
 * Случайность — от браузера (`crypto`), не `Math.random`: в игре его нет
 * вовсе. Нет и `crypto` — берём время.
 */
export function newRunSeed(): number {
  try {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] ?? Date.now() >>> 0;
  } catch {
    return Date.now() >>> 0;
  }
}

export interface BootOptions {
  readonly level?: CitadelLevelId;
  /** Начать новый забег, даже если сохранённый есть. */
  readonly fresh?: boolean;
  /** Сид нового забега — для тестов; по умолчанию свой каждый раз. */
  readonly seed?: number;
  /** Где лежит сейв; по умолчанию — хранилище браузера. */
  readonly storage?: Storage;
}

export interface Boot {
  readonly storage: Storage;
  readonly save: SaveData;
  readonly run: RunState;
  readonly options: RunOptions;
  /** Цитадель забега вместе с её балансом. */
  readonly level: CitadelLevel;
  /** Поток досыпки: его состояние уходит в сохранение вместе с полем. */
  readonly refillRng: Rng;
  /** Сейв не прочитался, начали с чистого листа. */
  readonly recovered: boolean;
  /**
   * На устройстве сейв более новой версии игры: играем с чистого листа, но
   * поверх него ничего не пишем.
   */
  readonly readOnly: boolean;
  /** Забег новый, а не поднятый из сейва: поле раздаётся заново. */
  readonly fresh: boolean;
  /**
   * Столбец, из которого выйдет босс этой ночи, или null — ночь не босса.
   * Известен заранее: его подсвечивают в Сумерках, и бой возьмёт тот же.
   */
  readonly bossLane: (night: number) => number | null;
}

/** Столбец босса по сиду забега — тот же, что возьмёт бой (`buildOptions`). */
function bossLaneFor(seed: number): (night: number) => number | null {
  return (night) =>
    isBossNight(NIGHT_WAVE_PLAN.boss, night) ? bossColumn(seed, night, BOARD_CONFIG.width) : null;
}

function buildOptions(level: CitadelLevel, refillRng: Rng, waveRng: Rng): RunOptions {
  const seed = refillRng.snapshot().seed;
  return {
    rng: refillRng,
    resources: level.resources,
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
    projectileSpeed: BATTLE_CONFIG.projectileSpeed,
    spawnDepth: BATTLE_CONFIG.spawnDepth,
    shootDepth: BATTLE_CONFIG.shootDepth,
    waveFor: (night: number) =>
      nightWave(
        NIGHT_WAVE_PLAN,
        night,
        BOARD_CONFIG.width,
        waveRng,
        bossColumn(seed, night, BOARD_CONFIG.width),
      ),
  };
}

/**
 * Какие цитадели сейчас открыты. Пока — только Багровая: выбора цитадели в
 * интерфейсе нет, и забег, сохранённый в другой, начинается заново в ней —
 * иначе игрок застрял бы в цитадели без выхода. Остальные цитадели в конфиге
 * остаются и включаются здесь.
 */
const OPEN_LEVELS: readonly CitadelLevelId[] = [DEFAULT_LEVEL_ID];

/** Цитадель по имени. Незнакомое или закрытое имя откатывает на базовую (§12). */
function chooseLevel(id: CitadelLevelId): CitadelLevel {
  const open = OPEN_LEVELS.includes(id) ? id : DEFAULT_LEVEL_ID;
  const level = levelById(LEVELS, open) ?? levelById(LEVELS, DEFAULT_LEVEL_ID);
  if (level === null) {
    // Конфиг без базовой цитадели переживать молча нечем: играть не во что.
    throw new Error(`В levels.json нет цитадели «${DEFAULT_LEVEL_ID}»`);
  }
  return level;
}

/** Хранилище, которое читает, но молча не пишет: для чужого, более нового сейва. */
function readOnlyStorage(storage: Storage): Storage {
  return { read: (key) => storage.read(key), write: () => {}, remove: () => {} };
}

export function boot(options: BootOptions = {}): Boot {
  const disk = options.storage ?? createBrowserStorage();
  const loaded = loadSave(disk.read(STORAGE_KEY));
  // Сейв новее этой сборки (её отдал старый кэш) — играть можно, но поверх
  // него ничего не пишется: это прогресс, а не мусор.
  const storage = loaded.tooNew === true ? readOnlyStorage(disk) : disk;
  const nests = createNests(CITADEL_CONFIG.nests);

  const saved = loaded.save.run;
  const level = chooseLevel(options.level ?? saved?.level ?? DEFAULT_LEVEL_ID);

  // Сохранённый забег поднимаем только в своей цитадели: параметры у них разные,
  // и поле из Голодной ночи в Багровой было бы полем с чужими правилами.
  if (options.fresh !== true && saved !== null && saved.level === level.id) {
    const restored = saveToRun(saved, nests);
    // Сейв с пустой кровью — ночь, которая уже кончилась, а рассвет не успел.
    // Такой бывает только у старых сейвов; доливаем норму, иначе игрок застрял бы
    // без хода и без рассвета.
    const run = isExhausted(restored.run.purse)
      ? {
          ...restored.run,
          purse: grantSwaps(restored.run.purse, ECONOMY_CONFIG.swapsPerNight),
        }
      : restored.run;
    const waveRng = createRng(restored.rng.snapshot().seed).fork('wave');
    return {
      storage,
      save: loaded.save,
      run,
      options: buildOptions(level, restored.rng, waveRng),
      level,
      refillRng: restored.rng,
      recovered: loaded.recovered,
      readOnly: loaded.tooNew === true,
      fresh: false,
      bossLane: bossLaneFor(restored.rng.snapshot().seed),
    };
  }

  // Своё зерно на цитадель: при одном сиде цитадели всё равно разные.
  const seed = createRng(options.seed ?? newRunSeed()).fork(level.id);
  const refillRng = seed.fork('refill');
  return {
    storage,
    save: loaded.save,
    run: freshRun({
      rng: seed,
      width: BOARD_CONFIG.width,
      height: BOARD_CONFIG.height,
      resources: level.resources,
      withoutMatches: BOARD_CONFIG.startWithoutMatches,
      hearts: CITADEL_CONFIG.startHearts,
      maxHearts: CITADEL_CONFIG.maxHearts,
      swaps: ECONOMY_CONFIG.swapsPerNight + level.startSwaps,
      nests,
      carried: loaded.save.carried,
    }),
    options: buildOptions(level, refillRng, seed.fork('wave')),
    level,
    refillRng,
    recovered: loaded.recovered,
    readOnly: loaded.tooNew === true,
    fresh: true,
    bossLane: bossLaneFor(refillRng.snapshot().seed),
  };
}
