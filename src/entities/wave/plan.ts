import type { Rng } from '@/shared/lib/rng';

import type { BossPlan } from './boss';
import { bossSpawns, isBossNight } from './boss';
import type { WaveConfig, WaveSpawn } from './types';

/**
 * Состав волны на ночь — как в оригинале (docs/original-analysis.md).
 *
 * Врагов ⌈perNight × ночь⌉ + base. Выходят **колонной**: все разом, но
 * растянуты по высоте на (ночь / spreadEveryNights + 1) клеток — каждый
 * следующий чуть позже предыдущего. Столбец у каждого свой, случайный.
 *
 * После ночи `late.fromNight` волна другая: меньше врагов в начале, но по
 * `late.perNight` прибавляется каждую ночь, колонна плотнее, и идут враги
 * вида `late.kind`.
 *
 * В ночь босса выходит только проповедник, а его паства — после его гибели.
 */
export interface RegularWavePlan {
  /** Вид обычного врага. */
  readonly kind: string;
  /** Сколько врагов прибавляется за ночь (дробное: округляется вверх). */
  readonly perNight: number;
  /** Сколько врагов сверх роста. */
  readonly base: number;
  /** Раз во столько ночей колонна вытягивается ещё на клетку. */
  readonly spreadEveryNights: number;
  /** Волны после поздней ночи. Не задано — формула та же, что и раньше. */
  readonly late?: LateWavePlan | undefined;
}

export interface LateWavePlan {
  /** После этой ночи (не включая). */
  readonly fromNight: number;
  readonly kind: string;
  /** Обычное число врагов умножается на это… */
  readonly factor: number;
  /** …из него вычитается это… */
  readonly minus: number;
  /** …и прибавляется столько за каждую ночь после `fromNight`. */
  readonly perNight: number;
  /** Во сколько раз колонна плотнее. */
  readonly spreadFactor: number;
}

export interface NightWavePlan {
  readonly regular: RegularWavePlan;
  readonly boss: BossPlan;
  /** За сколько секунд обычный враг проходит клетку в «нулевую» ночь. */
  readonly secondsPerCell: number;
  /** На какую долю за ночь растёт скорость обычного врага. */
  readonly speedGrowthPerNight?: number;
}

function isLate(
  plan: RegularWavePlan,
  night: number,
): plan is RegularWavePlan & {
  late: LateWavePlan;
} {
  return plan.late !== undefined && night > plan.late.fromNight;
}

export function regularCount(plan: RegularWavePlan, night: number): number {
  // Ноль после запятой у произведения (2.6 × 5 = 13.000000000000002) не должен
  // добавлять врага: округляем с допуском.
  const base = Math.ceil(plan.perNight * night - 1e-9) + plan.base;
  if (!isLate(plan, night)) return base;
  const { late } = plan;
  return (
    Math.max(0, Math.ceil(late.factor * base - 1e-9) - late.minus) +
    (night - late.fromNight) * late.perNight
  );
}

/** На сколько клеток по высоте растянута колонна. */
export function columnLength(plan: RegularWavePlan, night: number): number {
  const length = night / plan.spreadEveryNights + 1;
  return isLate(plan, night) ? length * plan.late.spreadFactor : length;
}

export function regularWave(
  plan: RegularWavePlan,
  night: number,
  columns: number,
  rng: Rng,
  secondsPerCell: number,
): WaveSpawn[] {
  const count = regularCount(plan, night);
  const kind = isLate(plan, night) ? plan.late.kind : plan.kind;
  const length = columnLength(plan, night);
  return Array.from({ length: count }, (_, index) => ({
    id: `n${String(night)}-${String(index)}`,
    kind,
    column: rng.int(0, columns),
    // i-й из count — на i/count длины колонны ниже первого.
    atSecond: ((index + 1) / count) * length * secondsPerCell,
  }));
}

export function nightWave(
  plan: NightWavePlan,
  night: number,
  columns: number,
  rng: Rng,
  /** Столбец босса, заранее показанный игроку (`bossColumn`). */
  bossColumn?: number,
): WaveConfig {
  if (isBossNight(plan.boss, night)) {
    return { spawns: bossSpawns(plan.boss, night, columns, rng, bossColumn) };
  }
  // Враги к этой ночи ускорились — колонна должна растягиваться на те же клетки.
  const secondsPerCell = plan.secondsPerCell / (1 + (plan.speedGrowthPerNight ?? 0) * night);
  return { spawns: regularWave(plan.regular, night, columns, rng, secondsPerCell) };
}
