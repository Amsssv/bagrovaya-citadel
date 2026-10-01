import { t } from '@/shared/lib/i18n';

/**
 * Надпись о крови, налитой не каплями с поля, а бонусом: за комбо и за длинное
 * слияние. Как в оригинале, комбо чем длиннее, тем громче называется.
 */
const COMBO = ['bonus.combo.c1', 'bonus.combo.c2', 'bonus.combo.c3', 'bonus.combo.c4'] as const;

export interface BonusToast {
  readonly title: string;
  readonly detail: string;
}

/** null — бонуса не было, показывать нечего. */
export function bonusToast(
  groups: number,
  comboBonus: number,
  mergeBonus: number,
): BonusToast | null {
  const total = comboBonus + mergeBonus;
  if (total <= 0) return null;
  // Комбо начинается с трёх групп: 3 → первое имя, 6 и больше — последнее.
  const combo = COMBO[Math.max(0, Math.min(COMBO.length - 1, groups - 3))] ?? COMBO[0];
  const title = comboBonus > 0 ? t(combo) : t('bonus.bigMerge');
  const detail = t('bonus.detail', { count: total, drops: t('plural.drops', { count: total }) });
  return { title, detail };
}
