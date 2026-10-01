import type { BeatId, TipId } from '@/features/tutorial';
import { t } from '@/shared/lib/i18n';

/**
 * Тексты обучения — в словарях (`shared/lib/i18n/locales`): шаги сценария —
 * `tutorial.beat.<шаг>`, подсказки к первой встрече — `tutorial.tip.<вид>`.
 * Коротко: подсказка у хода — одна строка, карточка — пара строк; всё
 * подробное — в справке.
 */
export interface TutorialText {
  readonly title: string;
  readonly text: string;
}

export function beatText(id: BeatId): TutorialText {
  return { title: t(`tutorial.beat.${id}.title`), text: t(`tutorial.beat.${id}.text`) };
}

export function tipText(id: TipId): TutorialText {
  return { title: t(`tutorial.tip.${id}.title`), text: t(`tutorial.tip.${id}.text`) };
}

/** Кадр атласа к подсказке. */
export function tipFrame(tip: TipId): string {
  if (tip === 'potion') return 'potion-raw';
  if (tip === 'turret') return 'gargoyle-raw';
  return `${tip}-raw`;
}
