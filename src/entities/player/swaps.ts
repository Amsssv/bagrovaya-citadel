/**
 * Кошелёк свапов (§3, §8).
 *
 * Свап — и единственное действие игрока, и главный расходуемый ресурс: ходы
 * тратятся, потиры их возвращают, и когда запас кончился — ночь заканчивается
 * (§2). Поэтому здесь ведётся не одно число, а весь счёт: начало, выдано,
 * потрачено. По ним в любой момент видно, что экономика сходится.
 */
export interface SwapPurse {
  readonly swaps: number;
  readonly initial: number;
  readonly spent: number;
  readonly granted: number;
}

function assertNonNegative(amount: number, what: string): void {
  if (amount < 0) throw new RangeError(`${what} не может быть отрицательным`);
}

export function createPurse(swaps: number): SwapPurse {
  assertNonNegative(swaps, 'Запас свапов');
  return { swaps, initial: swaps, spent: 0, granted: 0 };
}

export function canSpend(purse: SwapPurse, amount = 1): boolean {
  return purse.swaps >= amount;
}

export function spendSwaps(purse: SwapPurse, amount = 1): SwapPurse {
  assertNonNegative(amount, 'Трата');
  if (!canSpend(purse, amount)) {
    throw new RangeError(`Свапов не хватает: нужно ${String(amount)}, есть ${String(purse.swaps)}`);
  }
  return { ...purse, swaps: purse.swaps - amount, spent: purse.spent + amount };
}

/** Потолка нет: Багровый потир даёт четыреста за раз (§8). */
export function grantSwaps(purse: SwapPurse, amount: number): SwapPurse {
  assertNonNegative(amount, 'Пополнение');
  return { ...purse, swaps: purse.swaps + amount, granted: purse.granted + amount };
}

/** Запас кончился — ночь заканчивается (§2). */
export function isExhausted(purse: SwapPurse): boolean {
  return purse.swaps <= 0;
}

/**
 * Кровь за длинный матч: группа длиной `from` даёт каплю, и каждая плитка
 * сверх неё — ещё по одной. При `from = 4` это «размер − 3». Считаются все
 * группы хода, каскады тоже — их всё равно устроил ход игрока.
 */
export function longMatchBonus(sizes: readonly number[], from: number): number {
  return sizes.reduce((total, size) => total + Math.max(0, size - from + 1), 0);
}
