import { t } from '@/shared/lib/i18n';

/**
 * Шкала крови: так на экране выглядят свапы.
 *
 * Капель на шкале ровно ночная норма — столько наливается после каждого боя.
 * Всё, что сверх (выпитый потир, длинные матчи), идёт подписью «+N»: ряд из
 * семидесяти капель на телефон не влезет, а норма должна читаться с одного
 * взгляда.
 */
export interface BloodDrops {
  readonly full: number;
  readonly empty: number;
  readonly extra: number;
}

export function bloodDrops(swaps: number, perNight: number): BloodDrops {
  const full = Math.min(swaps, perNight);
  return { full, empty: perNight - full, extra: Math.max(0, swaps - perNight) };
}

/** 1 капля, 2 капли, 5 капель, 21 капля — или 1 drop, 2 drops. */
export function dropsWord(count: number): string {
  return t('plural.drops', { count });
}

/** Подпись под шкалой: рассвет наступает сам, игрок должен видеть, когда. */
export function bloodCaption(swaps: number): string {
  if (swaps <= 0) return t('blood.caption.dawn');
  if (swaps === 1) return t('blood.caption.last');
  return t('blood.caption.left', { count: swaps, drops: dropsWord(swaps) });
}
