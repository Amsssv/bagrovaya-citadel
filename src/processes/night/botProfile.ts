/**
 * Повадки бота.
 *
 * Их две, и обе нужны ради одной проверки: §13 говорит, что разброс очков между
 * сильным игроком и новичком примерно в двадцать пять раз. Если у нас выйдет
 * трёхкратный, значит правила или цифры сняты неверно — и это надо увидеть
 * раньше релиза, а не после.
 */
export interface BotProfile {
  readonly name: string;
  /** Ценность новой постройки: ради неё бот и ищет тройки. */
  readonly building: number;
  /** Ценность слияния — оно дороже постройки, но освобождает клетки. */
  readonly merge: number;
  /** Ценность потира: он возвращает свапы, то есть продлевает забег. */
  readonly potion: number;
  /** Надбавка за постройку не у края: там половина огня уходит за поле (§7). */
  readonly centre: number;
  /**
   * Надбавка за горгулью, родившуюся под башней замка, — её следующим ходом
   * ставят в башню. 0 — бот о башнях не знает и в них ничего не ставит.
   */
  readonly turret: number;
  /** Ниже этого запаса бот идёт вскрывать потир. */
  readonly openPotionBelow: number;
  /** Сколько ходов бот тратит за ночь. */
  readonly movesPerNight: number;
  /** Доля ходов наугад: новичок ходит почти вслепую. */
  readonly randomness: number;
}

/** Новичок: ходит почти наугад, потиры не бережёт. */
export const NOVICE: BotProfile = {
  name: 'новичок',
  building: 1,
  merge: 1,
  potion: 1,
  centre: 0,
  turret: 0,
  openPotionBelow: 1,
  movesPerNight: 6,
  randomness: 0.8,
};

/** Умелый: ищет тройки и слияния, вскрывает потир, когда запас на исходе. */
export const ADEPT: BotProfile = {
  name: 'умелый',
  building: 3,
  merge: 8,
  potion: 5,
  centre: 1,
  turret: 6,
  openPotionBelow: 8,
  movesPerNight: 6,
  randomness: 0,
};

export const PROFILES: readonly BotProfile[] = [NOVICE, ADEPT];
