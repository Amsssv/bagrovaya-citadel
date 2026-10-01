/**
 * Счётчики забега. Их ведёт домен, а во что они складываются — решает формула
 * очков, которой в спеке нет (§14 #10). Поэтому считаем всё, что происходит, и
 * не смешиваем это с подсчётом.
 */
export interface RunStats {
  readonly nights: number;
  readonly enemiesKilled: number;
  /** Побеждённые боссы — цели, за которые в оригинале даются очки. */
  readonly bossesKilled: number;
  readonly enemiesLeaked: number;
  readonly merges: number;
  /** Слияния до багровой ступени — потолок лестницы (§6). */
  readonly crimsonMerges: number;
  readonly potionsOpened: number;
  readonly swapsSpent: number;
  readonly itemsUsed: number;
  /**
   * Сколько построек каждой ступени держало оборону в последнюю ночь — не
   * накопительно, а снимок: слияние и перестановка счёт не размазывают.
   */
  readonly defense: DefenseTally;
}

/** Постройки на поле по ступеням. */
export interface DefenseTally {
  readonly raw: number;
  readonly bone: number;
  readonly obsidian: number;
  readonly crimson: number;
}

export const NO_DEFENSE: DefenseTally = { raw: 0, bone: 0, obsidian: 0, crimson: 0 };

export const EMPTY_STATS: RunStats = {
  nights: 0,
  enemiesKilled: 0,
  bossesKilled: 0,
  enemiesLeaked: 0,
  merges: 0,
  crimsonMerges: 0,
  potionsOpened: 0,
  swapsSpent: 0,
  itemsUsed: 0,
  defense: NO_DEFENSE,
};

export interface NightTally {
  readonly killed: number;
  readonly leaked: number;
  readonly bossesKilled?: number;
  /** Постройки на поле этой ночью; нет — прежний снимок остаётся. */
  readonly defense?: DefenseTally;
}

export function addNight(stats: RunStats, tally: NightTally): RunStats {
  return {
    ...stats,
    nights: stats.nights + 1,
    enemiesKilled: stats.enemiesKilled + tally.killed,
    bossesKilled: stats.bossesKilled + (tally.bossesKilled ?? 0),
    enemiesLeaked: stats.enemiesLeaked + tally.leaked,
    defense: tally.defense ?? stats.defense,
  };
}

export interface MoveTally {
  readonly merges: number;
  readonly crimsonMerges: number;
  readonly potionOpened: boolean;
  readonly swapsSpent: number;
  readonly itemUsed: boolean;
}

export function addMove(stats: RunStats, tally: MoveTally): RunStats {
  return {
    ...stats,
    merges: stats.merges + tally.merges,
    crimsonMerges: stats.crimsonMerges + tally.crimsonMerges,
    potionsOpened: stats.potionsOpened + (tally.potionOpened ? 1 : 0),
    swapsSpent: stats.swapsSpent + tally.swapsSpent,
    itemsUsed: stats.itemsUsed + (tally.itemUsed ? 1 : 0),
  };
}
