/**
 * Сердца — здоровье замка (§9). Потолок 30; охотник, дошедший до цитадели,
 * снимает столько, сколько указано в его описании.
 *
 * Не путать с сердцами-энергией из меты: те тратятся за проигрыш и живут вне
 * забега. Здесь речь только о здоровье внутри забега.
 */
export interface Citadel {
  readonly hearts: number;
  readonly maxHearts: number;
}

export function createCitadel(hearts: number, maxHearts: number): Citadel {
  if (maxHearts <= 0) throw new RangeError('Потолок сердец должен быть положительным');
  return { hearts: Math.min(hearts, maxHearts), maxHearts };
}

export function damageCitadel(citadel: Citadel, amount: number): Citadel {
  if (amount < 0) throw new RangeError('Урон не может быть отрицательным');
  return { ...citadel, hearts: Math.max(0, citadel.hearts - amount) };
}

export function restoreHearts(citadel: Citadel, amount: number): Citadel {
  if (amount < 0) throw new RangeError('Пополнение не может быть отрицательным');
  return { ...citadel, hearts: Math.min(citadel.maxHearts, citadel.hearts + amount) };
}

export function isFallen(citadel: Citadel): boolean {
  return citadel.hearts <= 0;
}
