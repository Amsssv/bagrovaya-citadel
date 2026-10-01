import type { Tier } from './tier';
import { previousTier } from './tier';

/**
 * Печати крови (§6) — обход лестницы: поднимают **одну** постройку на ступень,
 * не требуя трёх. Выпадают из Обсидиановых и Багровых потиров.
 *
 * Печать называется так же, как ступень, на которую поднимает, и подходит
 * только к постройке ровно на предыдущей ступени.
 *
 * На потиры печати не действуют: потир — не постройка. Помечено ❓ в спеке,
 * перепроверить в оригинале (§14 #16).
 */
export type SealId = 'bone' | 'obsidian' | 'crimson';

export const SEALS: readonly SealId[] = ['bone', 'obsidian', 'crimson'];

export function sealRaises(seal: SealId): { from: Tier; to: Tier } {
  return { from: previousTier(seal) as Tier, to: seal };
}

export function canSealTier(tier: Tier, seal: SealId): boolean {
  return sealRaises(seal).from === tier;
}

export function sealTier(tier: Tier, seal: SealId): Tier {
  if (!canSealTier(tier, seal)) {
    throw new Error(`Печать «${seal}» не подходит к ступени «${tier}»`);
  }
  return sealRaises(seal).to;
}
