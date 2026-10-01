/**
 * Охотники (§10). Идут строго вверх по своему столбцу, построек не обходят и не
 * ломают — проходят насквозь (§4). Поэтому ни поиска пути, ни обхода препятствий
 * в проекте нет и быть не должно.
 *
 * Характеристики неизвестны целиком: §10 говорит «Типы, здоровье, скорость, урон
 * цитадели ❓». Справочник приходит снаружи, боевой — пуст до прогона оригинала.
 */
export interface EnemySpec {
  /** Здоровье в «нулевую» ночь; к нему прибавляется рост. */
  readonly hp: number;
  /** Сколько здоровья прибавляется за каждую ночь. */
  readonly hpPerNight?: number | undefined;
  /** Клеток в секунду в «нулевую» ночь. */
  readonly speed: number;
  /** На какую долю растёт скорость за ночь: 0.013 — на 1,3 % за ночь. */
  readonly speedGrowthPerNight?: number | undefined;
  /** С какой ночи (не включая) даётся надбавка к здоровью `lateHpBonus`. */
  readonly lateFromNight?: number | undefined;
  readonly lateHpBonus?: number | undefined;
  /** Во сколько раз скорость выше после ночи `lateFromNight` (босс оригинала — 1,3). */
  readonly lateSpeedFactor?: number | undefined;
  /**
   * На сколько клеток попадание отбрасывает врага от стрелка — по вертикали.
   * В оригинале лёгкого дракона сносит, босса — нет. Не задано — не сносит.
   */
  readonly knockback?: number | undefined;
  readonly citadelDamage: number;
  /** Сняты ли цифры с оригинала. */
  readonly verified: boolean;
}

/** Характеристики врага в конкретную ночь. */
export interface EnemyStats {
  readonly hp: number;
  readonly speed: number;
  readonly citadelDamage: number;
  readonly knockback: number;
}

/**
 * Враг в ночь `night`: в оригинале здоровье и скорость растут от ночи к ночи
 * (docs/original-analysis.md). Здоровье не опускается ниже единицы — формула
 * босса в первые ночи дала бы отрицательное.
 */
export function statsAt(spec: EnemySpec, night: number): EnemyStats {
  const isLate = spec.lateFromNight !== undefined && night > spec.lateFromNight;
  const late = isLate ? (spec.lateHpBonus ?? 0) : 0;
  const speedFactor = isLate ? (spec.lateSpeedFactor ?? 1) : 1;
  return {
    hp: Math.max(1, spec.hp + (spec.hpPerNight ?? 0) * night + late),
    speed: spec.speed * (1 + (spec.speedGrowthPerNight ?? 0) * night) * speedFactor,
    citadelDamage: spec.citadelDamage,
    knockback: spec.knockback ?? 0,
  };
}

export type EnemyBook = Readonly<Record<string, EnemySpec>>;

export interface Hunter {
  readonly id: string;
  readonly kind: string;
  readonly column: number;
  /**
   * Дробная координата по вертикали. Цитадель сверху, поэтому охотник заходит
   * с большим y и уменьшает его; y < 0 — дошёл до ворот.
   */
  readonly y: number;
  readonly hp: number;
}

export function specFor(book: EnemyBook, kind: string): EnemySpec {
  const spec = book[kind];
  if (spec === undefined) throw new Error(`Неизвестный охотник: «${kind}»`);
  return spec;
}

/** Виды, чьи цифры ещё не сняты с оригинала. */
export function unverifiedHunters(book: EnemyBook): string[] {
  return Object.keys(book).filter((kind) => !book[kind]?.verified);
}

/** Клетка поля, на которой охотник считается стоящим. */
export function cellOf(hunter: Hunter, height: number): number {
  return Math.min(height - 1, Math.max(0, Math.round(hunter.y)));
}
