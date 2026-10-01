/**
 * Режим качества.
 *
 * Игра идёт на телефонах, и слабых среди них большинство. Частицы — первое, что
 * стоит выключить: на ходе боя они не сказываются никак, а кадров съедают
 * заметно. Бой при этом остаётся тем же: домен посчитал его целиком ещё до
 * первой картинки, и выключенная пыль на исход не влияет.
 */
export const QUALITIES = ['high', 'low'] as const;

export type Quality = (typeof QUALITIES)[number];

export interface QualityPlan {
  readonly particles: boolean;
  /** Сколько частиц живёт одновременно. Сверх потолка новые просто не заводим. */
  readonly maxEffects: number;
}

/**
 * Потолок нужен и в полном режиме: багровая горгулья бьёт пятнадцать раз в
 * секунду, и таких на поле бывает шесть. Пыль от каждого попадания без потолка
 * завалила бы сцену сотнями спрайтов.
 */
const HIGH: QualityPlan = { particles: true, maxEffects: 24 };
const LOW: QualityPlan = { particles: false, maxEffects: 0 };

export function planFor(quality: Quality): QualityPlan {
  return quality === 'low' ? LOW : HIGH;
}
