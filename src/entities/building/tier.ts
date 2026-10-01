/**
 * Лестница из четырёх ступеней (§6). Одна и та же у построек и у потиров:
 * три одинаковых одной ступени дают одну следующей.
 *
 * Багровая — потолок, выше ничего нет.
 */
export type Tier = 'raw' | 'bone' | 'obsidian' | 'crimson';

export const TIERS: readonly Tier[] = ['raw', 'bone', 'obsidian', 'crimson'];

export function nextTier(tier: Tier): Tier | null {
  return TIERS[TIERS.indexOf(tier) + 1] ?? null;
}

export function previousTier(tier: Tier): Tier | null {
  const index = TIERS.indexOf(tier);
  return index > 0 ? (TIERS[index - 1] as Tier) : null;
}

export function isMaxTier(tier: Tier): boolean {
  return nextTier(tier) === null;
}
