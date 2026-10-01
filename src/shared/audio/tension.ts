import type { MusicId } from './sounds';

/**
 * Какая музыка играет этой ночью.
 *
 * Ночи прихода проповедника известны точно (§10) — под них идёт своя тема.
 * С какой ночи бой считается напряжённым, спека не говорит: порог приходит
 * настройкой, а не зашит здесь.
 */
export interface TensionRule {
  /** Ночи, на которые приходит проповедник. */
  readonly bossNights: readonly number[];
  /** С какой ночи спокойная тема сменяется напряжённой. */
  readonly tenseFromNight: number;
}

export function musicForNight(night: number, rule: TensionRule): MusicId {
  if (rule.bossNights.includes(night)) return 'boss';
  return night >= rule.tenseFromNight ? 'tense' : 'calm';
}
