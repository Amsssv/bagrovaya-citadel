import { describe, expect, it } from 'vitest';

import { addItem, countOf, createInventory, hasItem, removeItem, totalItems } from './inventory';

describe('инвентарь', () => {
  it('заводится пустым', () => {
    const inventory = createInventory();
    expect(totalItems(inventory)).toBe(0);
    expect(countOf(inventory, 'cursed-ash')).toBe(0);
  });

  it('заводится с запасом', () => {
    const inventory = createInventory({ 'cursed-ash': 2, 'seal-bone': 1 });
    expect(countOf(inventory, 'cursed-ash')).toBe(2);
    expect(totalItems(inventory)).toBe(3);
  });

  it('добавление копится', () => {
    const inventory = addItem(addItem(createInventory(), 'bats'), 'bats', 3);
    expect(countOf(inventory, 'bats')).toBe(4);
  });

  it('трата уменьшает', () => {
    const inventory = removeItem(createInventory({ bats: 3 }), 'bats');
    expect(countOf(inventory, 'bats')).toBe(2);
  });

  it('последний предмет исчезает из инвентаря, а не висит нулём', () => {
    const inventory = removeItem(createInventory({ bats: 1 }), 'bats');
    expect(hasItem(inventory, 'bats')).toBe(false);
    expect(Object.keys(inventory.items)).toEqual([]);
  });

  it('hasItem видит наличие', () => {
    const inventory = createInventory({ bats: 1 });
    expect(hasItem(inventory, 'bats')).toBe(true);
    expect(hasItem(inventory, 'cursed-ash')).toBe(false);
    expect(hasItem(inventory, 'bats', 2)).toBe(false);
  });

  it('не трогает исходный инвентарь', () => {
    const inventory = createInventory({ bats: 2 });
    addItem(inventory, 'bats');
    removeItem(inventory, 'bats');
    expect(countOf(inventory, 'bats')).toBe(2);
  });
});

describe('чего в инвентаре нет', () => {
  it('потратить нечего — ошибка, а не уход в минус', () => {
    expect(() => removeItem(createInventory(), 'bats')).toThrow();
    expect(() => removeItem(createInventory({ bats: 1 }), 'bats', 2)).toThrow();
  });

  it('отрицательные количества — ошибка в обе стороны', () => {
    expect(() => addItem(createInventory(), 'bats', -1)).toThrow();
    expect(() => removeItem(createInventory({ bats: 5 }), 'bats', -1)).toThrow();
    expect(() => createInventory({ bats: -1 })).toThrow();
  });
});
