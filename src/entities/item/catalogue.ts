import type { SealId } from '@/entities/building';

/**
 * Предметы (§11). Переносятся между забегами и выпадают из верхних потиров (§8).
 *
 * `target` говорит, что игрок должен указать при применении. `unknown` — не
 * «ничего», а «спека не говорит, как это применяется»:
 *
 *   hourglass      — «перезапускают ночь и возвращают всё потраченное»: нужен
 *                    снимок ночи, а он появится на шаге 12 вместе с отменой хода
 *   bat-nest       — «периодически выдаёт нетопырей»: неизвестно, с какой частотой
 *   elder-bargain  — «случайное событие»: ни повода, ни курса обмена
 *   thrall         — §14 #12, механика неясна прямым текстом
 */
export type ItemId =
  | 'cursed-ash'
  | 'seal-bone'
  | 'seal-obsidian'
  | 'seal-crimson'
  | 'bats'
  | 'bat-nest'
  | 'hourglass'
  | 'fog-pillar'
  | 'elder-bargain'
  | 'thrall';

export type ItemTarget = 'none' | 'cell' | 'two-cells' | 'unknown';

export interface ItemSpec {
  readonly target: ItemTarget;
  /** Какую печать несёт предмет, если это печать крови. */
  readonly seal?: SealId;
}

export type ItemBook = Readonly<Record<string, ItemSpec>>;

export const ITEMS: ItemBook = {
  'cursed-ash': { target: 'cell' },
  'seal-bone': { target: 'cell', seal: 'bone' },
  'seal-obsidian': { target: 'cell', seal: 'obsidian' },
  'seal-crimson': { target: 'cell', seal: 'crimson' },
  bats: { target: 'two-cells' },
  'fog-pillar': { target: 'cell' },
  hourglass: { target: 'unknown' },
  'bat-nest': { target: 'unknown' },
  'elder-bargain': { target: 'unknown' },
  thrall: { target: 'unknown' },
};

/**
 * Все виды предметов. В таблице §11 восемь строк, а видов десять: печати крови
 * занимают одну строку, но в инвентаре лежат порознь — костяная, обсидиановая и
 * багровая поднимают разные ступени.
 */
export const ITEM_IDS: readonly ItemId[] = Object.keys(ITEMS) as ItemId[];

/** Строк в таблице §11 — по ним сверяемся со спекой. */
export const SPEC_ROWS = 8;

export function specOf(book: ItemBook, id: ItemId): ItemSpec {
  const spec = book[id];
  if (spec === undefined) throw new Error(`Неизвестный предмет: «${id}»`);
  return spec;
}

/** Печать, которую несёт предмет, или null. */
export function sealOfItem(id: ItemId): SealId | null {
  return ITEMS[id]?.seal ?? null;
}

/** Предметы, применение которых уже описано и реализовано. */
export function usableItems(book: ItemBook): ItemId[] {
  return Object.keys(book).filter(
    (id) => specOf(book, id as ItemId).target !== 'unknown',
  ) as ItemId[];
}
