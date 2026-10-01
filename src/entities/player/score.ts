import type { RunStats } from './stats';

/**
 * Очки — взвешенная сумма счётчиков забега. Веса — в `balance.ts → score`.
 *
 * В оригинале формула простая: **день + 1000 × число побеждённых боссов**
 * (docs/original-analysis.md). У нас — 100 за ночь, 1000 за босса, 1 за
 * убитого врага и стоимость построек на поле в последнюю ночь по ступеням.
 */
export interface ScoreWeights {
  readonly night: number;
  readonly kill: number;
  readonly merge: number;
  readonly crimsonMerge: number;
  readonly potion: number;
  /** За побеждённого босса. */
  readonly boss: number;
  /** За каждую постройку на поле в последнюю ночь — по ступени; нет — ноль. */
  readonly building?: {
    readonly raw: number;
    readonly bone: number;
    readonly obsidian: number;
    readonly crimson: number;
  };
}

export function computeScore(stats: RunStats, weights: ScoreWeights): number {
  return Math.round(
    stats.nights * weights.night +
      stats.enemiesKilled * weights.kill +
      stats.merges * weights.merge +
      stats.crimsonMerges * weights.crimsonMerge +
      stats.potionsOpened * weights.potion +
      stats.bossesKilled * weights.boss +
      defenseScore(stats, weights),
  );
}

/** Постройки на поле в последнюю ночь — по весу своей ступени. */
function defenseScore(stats: RunStats, weights: ScoreWeights): number {
  const building = weights.building;
  if (building === undefined) return 0;
  const { raw, bone, obsidian, crimson } = stats.defense;
  return (
    raw * building.raw +
    bone * building.bone +
    obsidian * building.obsidian +
    crimson * building.crimson
  );
}
