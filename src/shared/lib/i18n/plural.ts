/**
 * Русская форма слова по числу: 1 капля, 2 капли, 5 капель, 21 капля.
 * Формы — в порядке «одна», «несколько», «много».
 */
export type PluralForms = readonly [one: string, few: string, many: string];

/** Английская форма: 1 drop, 2 drops. */
export type PluralFormsEn = readonly [one: string, other: string];

export function pluralRu(count: number, [one, few, many]: PluralForms): string {
  const tens = Math.abs(count) % 100;
  const ones = tens % 10;
  if (tens >= 11 && tens <= 14) return many;
  if (ones === 1) return one;
  if (ones >= 2 && ones <= 4) return few;
  return many;
}

export function pluralEn(count: number, [one, other]: PluralFormsEn): string {
  return Math.abs(count) === 1 ? one : other;
}
