/**
 * Виды построек и ступени — ключи прежнего арта (SVG-глифы и цвета ступеней).
 *
 * Списки видов и ступеней здесь повторяют доменные: `shared` не имеет права
 * знать про `entities`. Чтобы они не разошлись, в виджете поля лежит тест,
 * который сверяет их с доменными напрямую.
 */
export const BUILDING_ARTS = ['gargoyle', 'vine', 'mortar', 'fogveil'] as const;

export const TIER_ARTS = ['raw', 'bone', 'obsidian', 'crimson'] as const;
