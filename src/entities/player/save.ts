import { z } from 'zod';

import { DEFAULT_LEVEL_ID } from '@/entities/citadel';

/**
 * Сохранение. Прогресс лежит на устройстве и не требует регистрации (§13), а
 * предметы переносятся между забегами (§11) — поэтому инвентарь хранится
 * отдельно от самого забега.
 *
 * Правила, от которых нельзя отступать:
 *
 *   — версия пишется всегда, с первого дня;
 *   — миграции только добавляются, старые не удаляются никогда: иначе сейв
 *     игрока, не заходившего полгода, станет нечитаемым;
 *   — битый сейв не ломает запуск. Грузим значения по умолчанию и говорим об
 *     этом вызывающему флагом, а не исключением — белого экрана быть не должно.
 *
 * Из гнёзд цитадели (башен замка) в сейв попадает только содержимое: раскладка
 * лежит в конфиге.
 */
export const SAVE_VERSION = 3;

const TierSchema = z.enum(['raw', 'bone', 'obsidian', 'crimson']);

const CellSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('empty') }),
  z.object({
    kind: z.literal('tile'),
    resource: z.enum(['stone', 'thorn', 'ash', 'fog', 'blood']),
  }),
  z.object({
    kind: z.literal('building'),
    building: z.enum(['gargoyle', 'vine', 'mortar', 'fogveil']),
    tier: TierSchema,
    /** Куда смотрит мортира, если её разворачивали. У старых сейвов поля нет. */
    facing: z.enum(['left', 'right']).optional(),
  }),
  z.object({ kind: z.literal('potion'), tier: TierSchema }),
]);

const StatsSchema = z.object({
  nights: z.int().nonnegative(),
  enemiesKilled: z.int().nonnegative(),
  /** Добавлено позже: у старых сейвов поля нет — значит, боссов не побеждали. */
  bossesKilled: z.int().nonnegative().default(0),
  enemiesLeaked: z.int().nonnegative(),
  merges: z.int().nonnegative(),
  crimsonMerges: z.int().nonnegative(),
  potionsOpened: z.int().nonnegative(),
  swapsSpent: z.int().nonnegative(),
  itemsUsed: z.int().nonnegative(),
  /** Добавлено позже: у старых сейвов — ноль построек. */
  defense: z
    .object({
      raw: z.int().nonnegative(),
      bone: z.int().nonnegative(),
      obsidian: z.int().nonnegative(),
      crimson: z.int().nonnegative(),
    })
    .default({ raw: 0, bone: 0, obsidian: 0, crimson: 0 }),
});

const RunSaveSchema = z.object({
  /** Цитадель-уровень, которой принадлежит забег (§12). Не путать с замком. */
  level: z.string().min(1),
  night: z.int().positive(),
  hearts: z.int().nonnegative(),
  maxHearts: z.int().positive(),
  purse: z.object({
    swaps: z.int().nonnegative(),
    initial: z.int().nonnegative(),
    spent: z.int().nonnegative(),
    granted: z.int().nonnegative(),
  }),
  inventory: z.record(z.string(), z.int().nonnegative()),
  board: z.object({
    width: z.int().positive(),
    height: z.int().positive(),
    cells: z.array(CellSchema),
  }),
  rng: z.object({ seed: z.int(), state: z.int() }),
  stats: StatsSchema,
  /**
   * Что стоит в башнях замка: id гнезда → постройка. Раскладка самих гнёзд —
   * из конфига. У старых сейвов поля нет — башни пустые.
   */
  /** Цитадель уже чинили в этом забеге (раз за забег). У старых сейвов — нет. */
  repaired: z.boolean().default(false),
  /** Ночь — выходной (день перестановки). У старых сейвов поля нет — обычная. */
  dayOff: z.boolean().default(false),
  /** Выходной в забеге уже брали (он один на забег). У старых сейвов — нет. */
  dayOffTaken: z.boolean().default(false),
  nests: z
    .record(
      z.string(),
      z.object({ cell: CellSchema, facing: z.enum(['up', 'down', 'left', 'right']) }),
    )
    .default({}),
});

const SaveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  /**
   * Когда сейв последний раз менялся, мс. По нему решают, какой сейв новее —
   * на устройстве или в облаке (`sync.ts`). Старые сейвы — ноль: любой облачный
   * новее.
   */
  savedAt: z.number().nonnegative().default(0),
  /** Забег в процессе или null, если игрок между забегами. */
  run: RunSaveSchema.nullable(),
  /** Предметы, переносимые между забегами (§11). */
  carried: z.record(z.string(), z.int().nonnegative()),
  /** Летопись по цитаделям: рекорды разных цитаделей между собой не сравнивают (§12). */
  best: z.record(
    z.string(),
    z.object({ score: z.int().nonnegative(), nights: z.int().nonnegative() }),
  ),
  settings: z.object({
    speed: z.union([z.literal(1), z.literal(2)]),
    /**
     * Режим качества. У поля есть значение по умолчанию, поэтому миграции оно не
     * требует: сейв без него читается как есть. Миграции заводим, когда данные
     * надо **перенести**, а не когда добавилась внешность.
     */
    quality: z.enum(['high', 'low']).default('high'),
    /** Справку «Как играть» уже показывали: сама она открывается только раз. */
    guideSeen: z.boolean().default(false),
    /** Обучение первого забега пройдено или пропущено: второй раз его не будет. */
    tutorialDone: z.boolean().default(false),
    /** Подсказки к первой встрече, которые уже показаны (`features/tutorial`). */
    tips: z.array(z.string()).default([]),
    /** Спрашивать ли «Выбросить постройку?» перед сбросом её за край. */
    confirmToss: z.boolean().default(true),
    /** Громкость музыки и эффектов, 0–1, и общий выключатель звука. */
    sound: z
      .object({
        music: z.number().min(0).max(1),
        sfx: z.number().min(0).max(1),
        muted: z.boolean(),
      })
      .default({ music: 0.45, sfx: 0.7, muted: false }),
  }),
});

export type SaveData = z.infer<typeof SaveSchema>;
export type RunSave = z.infer<typeof RunSaveSchema>;

export const EMPTY_SAVE: SaveData = {
  version: SAVE_VERSION,
  savedAt: 0,
  run: null,
  carried: {},
  best: {},
  settings: {
    speed: 1,
    quality: 'high',
    guideSeen: false,
    tutorialDone: false,
    tips: [],
    confirmToss: true,
    sound: { music: 0.45, sfx: 0.7, muted: false },
  },
};

/**
 * Миграция поднимает сейв на одну версию. Ключ — версия, **с** которой
 * поднимаем. Записи отсюда не удаляются никогда.
 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // 1 → 2: появились цитадели-уровни (§12). До этого играли только в Багровой,
  // поэтому и забег, и единственный рекорд достаются ей.
  1: (data) => {
    const run = asRecord(data['run']);
    return {
      ...data,
      run: run === null ? null : { ...run, level: DEFAULT_LEVEL_ID },
      best: { [DEFAULT_LEVEL_ID]: data['best'] },
    };
  },
  // 2 → 3: на старте было 30 сердец, стало 5 (потолок — 36). Сердца
  // пополняет только ремонт, и тот — до стартовых, поэтому больше пяти у
  // забега быть не может: забег из старой версии урезаем до пяти, иначе он
  // так и доигрывался бы с 17 сердцами. Числа — те, что были при переходе, а
  // не из конфига: миграция не должна меняться вместе с балансом.
  2: (data) => {
    const run = asRecord(data['run']);
    if (run === null) return data;
    const hearts = typeof run['hearts'] === 'number' ? run['hearts'] : 0;
    return { ...data, run: { ...run, hearts: Math.min(hearts, 5), maxHearts: 36 } };
  },
};

export interface LoadResult {
  readonly save: SaveData;
  /** true — сейв не прочитался, взяли значения по умолчанию. */
  readonly recovered: boolean;
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      return asRecord(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function loadSave(
  raw: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): LoadResult {
  const record = asRecord(raw);
  if (record === null) return { save: EMPTY_SAVE, recovered: true };

  let data = record;
  let version = typeof data['version'] === 'number' ? data['version'] : 0;

  while (version < SAVE_VERSION) {
    const migration = migrations[version];
    if (migration === undefined) return { save: EMPTY_SAVE, recovered: true };
    try {
      data = migration(data);
    } catch {
      // Сломанная миграция — это тот же битый сейв: белого экрана быть не должно.
      return { save: EMPTY_SAVE, recovered: true };
    }
    version += 1;
    data = { ...data, version };
  }

  const parsed = SaveSchema.safeParse(data);
  return parsed.success
    ? { save: parsed.data, recovered: false }
    : { save: EMPTY_SAVE, recovered: true };
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}
