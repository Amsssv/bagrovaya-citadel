import type { Cell, ResourceId } from '@/entities/board';
import { HARVEST } from '@/entities/board';
import type { BuildingId, Tier } from '@/entities/building';
import { TIERS, statsFor } from '@/entities/building';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { POTION_SWAPS } from '@/shared/config/economy';
import { t } from '@/shared/lib/i18n';

/**
 * Содержимое справки «Как играть».
 *
 * Пишем только то, что в игре уже работает, и без выдуманных цифр из `balance.ts` (⚠️):
 * справка, которая обещает несуществующее или врёт в числах, хуже никакой.
 *
 * Что во что превращается, берётся из домена (`HARVEST`), а не пишется второй
 * раз: здесь только слова.
 */
export type Harvest = BuildingId | 'potion';

export type GuideTabId = 'night' | 'matches' | 'tiers' | 'enemies';

export const GUIDE_TABS: readonly { readonly id: GuideTabId }[] = [
  { id: 'night' },
  { id: 'matches' },
  { id: 'tiers' },
  { id: 'enemies' },
];

export interface MatchRow {
  readonly resource: ResourceId;
  readonly tileName: string;
  readonly yields: Harvest;
  readonly resultName: string;
  readonly role: string;
}

export function matchRows(): MatchRow[] {
  return (Object.keys(HARVEST) as ResourceId[]).map((resource) => {
    const yields = HARVEST[resource];
    return {
      resource,
      tileName: t(`names.tile.${resource}`),
      yields,
      resultName: t(`names.building.${yields}`),
      role: t(`roles.${yields}`),
    };
  });
}

export interface LadderRow {
  readonly tier: Tier;
  readonly name: string;
}

export function ladderRows(): LadderRow[] {
  return TIERS.map((tier) => ({ tier, name: t(`tiers.building.${tier}`) }));
}

/** «10, 20, 30, 40 и 50» — ночи боссов берутся из конфига, а не пишутся руками. */
export function listNights(nights: readonly number[]): string {
  const words = nights.map(String);
  const last = words.pop();
  if (last === undefined) return '';
  const and = t('common.and');
  return words.length === 0 ? last : `${words.join(', ')} ${and} ${last}`;
}

/** Что показать по долгому нажатию на клетку: название, дело и цифры. */
export interface CellInfo {
  readonly title: string;
  readonly text: string;
  /** Цифры ступени — строкой под текстом; пусто — цифр нет. */
  readonly stats: string;
  /** Кадр атласа — та же картинка, что на поле. */
  readonly frame: string;
}

/** Дробь по правилам языка: «3,53» по-русски, «3.53» по-английски. */
const round = (value: number): string =>
  (Math.round(value * 100) / 100).toLocaleString(t('common.locale'));

export function describeCell(cell: Cell): CellInfo | null {
  if (cell.kind === 'empty') return null;
  if (cell.kind === 'tile') {
    const yields = HARVEST[cell.resource];
    return {
      title: t(`names.tile.${cell.resource}`),
      text: t('cell.tileMakes', { name: t(`names.building.${yields}`).toLowerCase() }),
      stats: '',
      frame: `tile-${cell.resource}`,
    };
  }
  if (cell.kind === 'potion') {
    const swaps = POTION_SWAPS[cell.tier];
    return {
      title: t('cell.potionTitle', { tier: t(`tiers.potion.${cell.tier}`) }),
      text: t('roles.potion'),
      stats: t('cell.potionHolds', { count: swaps, drops: t('plural.drops', { count: swaps }) }),
      frame: `potion-${cell.tier}`,
    };
  }
  const stats = statsFor(BUILDING_BOOK, cell.building, cell.tier);
  const numbers =
    cell.building === 'fogveil'
      ? t('cell.slows', { percent: Math.round(stats.slowFactor * 100) })
      : t('cell.damage', { damage: stats.damage, rate: round(stats.shotsPerSecond) });
  return {
    title: t('cell.buildingTitle', {
      name: t(`names.building.${cell.building}`),
      tier: t(`tiers.building.${cell.tier}`),
    }),
    text: t(`roles.${cell.building}`),
    stats: numbers,
    frame: `${cell.building}-${cell.tier}`,
  };
}
