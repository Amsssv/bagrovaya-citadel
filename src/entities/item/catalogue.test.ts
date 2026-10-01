import { describe, expect, it } from 'vitest';

import { SEALS } from '@/entities/building';

import { ITEMS, ITEM_IDS, SPEC_ROWS, sealOfItem, specOf, usableItems } from './catalogue';

describe('справочник предметов (§11)', () => {
  it('видов десять: в §11 восемь строк, но печатей три, и лежат они порознь', () => {
    expect(ITEM_IDS).toHaveLength(10);
    const seals = ITEM_IDS.filter((id) => sealOfItem(id) !== null);
    expect(ITEM_IDS.length - seals.length + 1).toBe(SPEC_ROWS);
  });

  it('у каждого сказано, что указывать при применении', () => {
    for (const id of ITEM_IDS) {
      expect(['none', 'cell', 'two-cells', 'unknown']).toContain(specOf(ITEMS, id).target);
    }
  });

  it('неизвестный предмет — ошибка', () => {
    expect(() => specOf(ITEMS, 'нет-такого' as never)).toThrow();
  });
});

describe('что уже можно применить', () => {
  it('прах, печати и столб тумана бьют по клетке', () => {
    for (const id of [
      'cursed-ash',
      'seal-bone',
      'seal-obsidian',
      'seal-crimson',
      'fog-pillar',
    ] as const) {
      expect(specOf(ITEMS, id).target, id).toBe('cell');
    }
  });

  it('нетопыри меняют местами две клетки', () => {
    expect(specOf(ITEMS, 'bats').target).toBe('two-cells');
  });

  it('usableItems перечисляет только то, что уже умеем', () => {
    expect(usableItems(ITEMS).sort()).toEqual(
      ['bats', 'cursed-ash', 'fog-pillar', 'seal-bone', 'seal-crimson', 'seal-obsidian'].sort(),
    );
  });

  it('остальные ждут ответов по спеке', () => {
    for (const id of ['hourglass', 'bat-nest', 'elder-bargain', 'thrall'] as const) {
      expect(specOf(ITEMS, id).target, id).toBe('unknown');
    }
  });
});

describe('печати крови — предметы и ступени', () => {
  it('на каждую печать свой предмет', () => {
    for (const seal of SEALS) {
      const found = ITEM_IDS.filter((id) => sealOfItem(id) === seal);
      expect(found, seal).toHaveLength(1);
    }
  });

  it('у непечатей печати нет', () => {
    expect(sealOfItem('cursed-ash')).toBeNull();
    expect(sealOfItem('bats')).toBeNull();
  });
});
