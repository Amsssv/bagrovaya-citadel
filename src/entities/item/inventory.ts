import type { ItemId } from './catalogue';

/**
 * Инвентарь (§11). Предметы переносятся между забегами, поэтому это простой
 * счётчик по видам, а не что-то привязанное к полю.
 *
 * Нулевых строк не держим: предмет, которого нет, из инвентаря исчезает — иначе
 * сохранение забега начнёт обрастать мусором.
 */
export interface Inventory {
  readonly items: Readonly<Record<string, number>>;
}

function assertPositive(amount: number): void {
  if (amount < 0) throw new RangeError('Количество предметов не может быть отрицательным');
}

export function createInventory(items: Readonly<Record<string, number>> = {}): Inventory {
  for (const amount of Object.values(items)) assertPositive(amount);
  return { items: { ...items } };
}

export function countOf(inventory: Inventory, id: ItemId): number {
  return inventory.items[id] ?? 0;
}

export function hasItem(inventory: Inventory, id: ItemId, amount = 1): boolean {
  return countOf(inventory, id) >= amount;
}

export function totalItems(inventory: Inventory): number {
  return Object.values(inventory.items).reduce((sum, amount) => sum + amount, 0);
}

export function addItem(inventory: Inventory, id: ItemId, amount = 1): Inventory {
  assertPositive(amount);
  return { items: { ...inventory.items, [id]: countOf(inventory, id) + amount } };
}

export function removeItem(inventory: Inventory, id: ItemId, amount = 1): Inventory {
  assertPositive(amount);
  if (!hasItem(inventory, id, amount)) {
    throw new RangeError(`Предмета «${id}» не хватает: нужно ${String(amount)}`);
  }

  const left = countOf(inventory, id) - amount;
  const items = { ...inventory.items };
  if (left === 0) delete items[id];
  else items[id] = left;
  return { items };
}
