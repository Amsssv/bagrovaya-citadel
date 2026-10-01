/**
 * Четыре постройки (§7). Потир постройкой не считается: он не стреляет, а даёт
 * свапы, — поэтому живёт отдельным видом клетки.
 */
export type BuildingId = 'gargoyle' | 'vine' | 'mortar' | 'fogveil';

export const BUILDINGS: readonly BuildingId[] = ['gargoyle', 'vine', 'mortar', 'fogveil'];
