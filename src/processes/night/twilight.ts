import type { Board, BuildingCell, Merge, MoveResult, ResolveOptions } from '@/entities/board';
import {
  applyBlast,
  applyEdgeDrop,
  applyLift,
  applyPlacement,
  applyPotionOpen,
  applySeal,
  applySwap,
  applyTeleport,
  EMPTY,
  building,
  canBlast,
  canDropOffEdge,
  canOpenPotion,
  canPlace,
  canSealAt,
  canSwap,
  canTeleport,
  facingOf,
  peekCell,
  withCells,
} from '@/entities/board';
import type { Tier } from '@/entities/building';
import { TIERS } from '@/entities/building';
import type { Nests } from '@/entities/citadel';
import { canPushToNest, pushToNest } from '@/entities/citadel';
import type { Inventory, ItemId } from '@/entities/item';
import { ITEMS, hasItem, removeItem, sealOfItem, specOf } from '@/entities/item';
import type { SwapPurse } from '@/entities/player';
import { canSpend, grantSwaps, isExhausted, longMatchBonus, spendSwaps } from '@/entities/player';
import type { Direction, Position } from '@/shared/lib/geometry';

/**
 * Сумерки — единственная фаза, где что-то делает игрок (§2).
 *
 * Свап (§3) — переставить соседей или сбросить сырой ресурс за край — тратит
 * каплю крови. Кровь возвращают два хода: выпить потир (бесплатно, по ступени
 * потира, §8) и длинный матч — каждая группа от четырёх плиток. Кончилась кровь
 * — Сумерки окончены.
 */
export type PlayerMove =
  | { readonly type: 'swap'; readonly from: Position; readonly to: Position }
  | { readonly type: 'drop'; readonly from: Position; readonly direction: Direction }
  | { readonly type: 'open'; readonly at: Position }
  /**
   * Вооружить башню замка (docs/original-analysis.md): горгулью из верхнего ряда
   * крайнего столбца тянут вверх, в стену. Как свап — тратит каплю крови.
   */
  | { readonly type: 'nest'; readonly from: Position; readonly direction: Direction }
  /**
   * Развернуть мортиру — как пушку в оригинале: тапом, бесплатно. Бьёт она
   * по-прежнему весь ряд, но сначала — тех, кто с новой стороны.
   */
  | { readonly type: 'flip'; readonly at: Position }
  /**
   * Ход предметом (§11). Клеток столько, сколько требует предмет: одна праху,
   * печати и столбу тумана, две нетопырям.
   *
   * §3 говорит, что в Сумерках нет ни тапов, ни спецкнопок, а §11 описывает
   * предметы, которые применяются именно так. Противоречие помечено в
   * docs/open-questions.md; пока считаем предметы отдельным действием.
   */
  | { readonly type: 'item'; readonly item: ItemId; readonly cells: readonly Position[] };

export interface MoveCosts {
  readonly swap: number;
  readonly drop: number;
  readonly open: number;
  readonly item: number;
  readonly nest: number;
  readonly flip?: number | undefined;
}

export interface TwilightOptions extends ResolveOptions {
  readonly costs: MoveCosts;
  /** Сколько свапов даёт потир каждой ступени (§8). */
  readonly potionSwaps: Readonly<Record<Tier, number>>;
  /** С какой длины группа наливает крови сверху. */
  readonly longMatchFrom: number;
  /**
   * Кровь за длинное слияние — как в оригинале: каждая клетка сверх трёх даёт
   * у построек `building ^ ступень` капель (3 · 9 · 27), у потиров — по
   * таблице. Не задано — длинные слияния крови не дают.
   */
  readonly longMerge?: LongMergeRules | undefined;
  /** С какого числа групп за ход даётся комбо. Не задано — комбо нет. */
  readonly comboFrom?: number | undefined;
}

export interface LongMergeRules {
  readonly building: number;
  readonly potion: Readonly<Record<Tier, number>>;
}

export interface TwilightState {
  readonly board: Board;
  readonly purse: SwapPurse;
  readonly inventory: Inventory;
  /** Гнёзда — башни замка. Нет — вооружать нечего. */
  readonly nests?: Nests | undefined;
}

export interface TwilightStep {
  readonly state: TwilightState;
  readonly move: MoveResult;
  readonly cost: number;
  /** Всё, что ход налил: потир, длинные матчи, длинные слияния и комбо. */
  readonly granted: number;
  /** Из них — за длинные матчи плиток: эта кровь летит к шкале каплями. */
  readonly bonus: number;
  /** За длинные слияния построек и потиров. */
  readonly mergeBonus: number;
  /** За комбо — много групп за один ход. */
  readonly comboBonus: number;
  /** Сколько групп (троек и слияний, с каскадами) сложил ход. */
  readonly groups: number;
}

/** Кровь за длинные слияния — как в оригинале. */
function longMergeBonus(merges: readonly Merge[], rules: LongMergeRules | undefined): number {
  if (rules === undefined) return 0;
  let total = 0;
  for (const merge of merges) {
    const extra = merge.cells.length - 3;
    if (extra <= 0) continue;
    // Слились клетки ступенью ниже той, что встала на их место.
    const source = TIERS.indexOf(merge.into.tier) - 1;
    const each =
      merge.into.kind === 'potion'
        ? rules.potion[TIERS[source] as Tier]
        : rules.building ** (source + 1);
    total += extra * each;
  }
  return total;
}

/** Комбо: от `from` групп за ход — капля, и по капле за каждую следующую. */
export function comboBonus(groups: number, from: number | undefined): number {
  if (from === undefined || groups < from) return 0;
  return groups - from + 1;
}

export function costOf(move: PlayerMove, costs: MoveCosts): number {
  return move.type === 'flip' ? (costs.flip ?? 0) : costs[move.type];
}

/** Куда смотрит мортира в этой клетке — как в бою: у правого края влево. */
export function mortarFacing(board: Board, at: Position): 'left' | 'right' {
  return facingOf(peekCell(board, at) ?? EMPTY, at.x, board.width);
}

function isMortar(board: Board, at: Position): boolean {
  const cell = peekCell(board, at);
  return cell?.kind === 'building' && cell.building === 'mortar';
}

/** Столб тумана ставится первой ступенью: выше — только слиянием (§6). */
const FOG_PILLAR = building('fogveil', 'raw');

/** Возможен ли ход предметом: хватает ли клеток и пускает ли поле. */
function isLegalItem(board: Board, item: ItemId, cells: readonly Position[]): boolean {
  const spec = specOf(ITEMS, item);
  const [first, second] = cells;

  if (spec.target === 'cell' && first !== undefined) {
    const seal = sealOfItem(item);
    if (seal !== null) return canSealAt(board, first, seal);
    if (item === 'fog-pillar') return canPlace(board, first);
    return canBlast(board, first);
  }
  if (spec.target === 'two-cells' && first !== undefined && second !== undefined) {
    return canTeleport(board, first, second);
  }
  return false;
}

/** Возможен ли ход на поле — без учёта кошелька и инвентаря. */
function isLegalOnBoard(state: TwilightState, move: PlayerMove): boolean {
  const { board } = state;
  switch (move.type) {
    case 'swap':
      return canSwap(board, move.from, move.to);
    case 'drop':
      return canDropOffEdge(board, move.from, move.direction);
    case 'open':
      return canOpenPotion(board, move.at);
    case 'item':
      return isLegalItem(board, move.item, move.cells);
    case 'nest':
      return (
        state.nests !== undefined && canPushToNest(board, state.nests, move.from, move.direction)
      );
    case 'flip':
      return isMortar(board, move.at);
  }
}

/** Применить предмет к полю. Разрешение хода за вызывающим. */
function runItem(
  board: Board,
  item: ItemId,
  cells: readonly Position[],
  options: ResolveOptions,
): MoveResult {
  const [first, second] = cells as [Position, Position];
  const seal = sealOfItem(item);
  if (seal !== null) return applySeal(board, first, seal, options);
  if (item === 'fog-pillar') return applyPlacement(board, first, FOG_PILLAR, options);
  if (item === 'bats') return applyTeleport(board, first, second, options);
  return applyBlast(board, first, options);
}

/** Хватает ли свапов и позволяет ли поле. */
export function canPlay(state: TwilightState, move: PlayerMove, options: TwilightOptions): boolean {
  if (move.type === 'item' && !hasItem(state.inventory, move.item)) return false;
  return canSpend(state.purse, costOf(move, options.costs)) && isLegalOnBoard(state, move);
}

export function playMove(
  state: TwilightState,
  move: PlayerMove,
  options: TwilightOptions,
): TwilightStep {
  const cost = costOf(move, options.costs);
  // Сначала платим, потом получаем: вскрыть потир можно и на последнем свапе.
  let purse = spendSwaps(state.purse, cost);
  let inventory = state.inventory;
  let nests = state.nests;

  let result: MoveResult;
  let granted = 0;

  switch (move.type) {
    case 'swap':
      result = applySwap(state.board, move.from, move.to, options);
      break;
    case 'drop':
      result = applyEdgeDrop(state.board, move.from, move.direction, options);
      break;
    case 'open': {
      const opened = applyPotionOpen(state.board, move.at, options);
      result = opened;
      granted = options.potionSwaps[opened.tier];
      purse = grantSwaps(purse, granted);
      break;
    }
    case 'item':
      inventory = removeItem(inventory, move.item);
      result = runItem(state.board, move.item, move.cells, options);
      break;
    case 'flip': {
      // Ход без досыпки: поле то же, у мортиры другое направление.
      const cell = peekCell(state.board, move.at) as BuildingCell;
      const facing = mortarFacing(state.board, move.at) === 'left' ? 'right' : 'left';
      const flipped = withCells(state.board, [[move.at, { ...cell, facing }]]);
      result = {
        board: flipped,
        matches: [],
        spawned: [],
        merges: [],
        fallen: new Map(),
        refilled: false,
        stages: [],
      };
      break;
    }
    case 'nest': {
      if (nests === undefined) throw new Error('Вооружать нечего: у забега нет башен замка');
      // Постройка уходит в башню, клетка под ней закрывается досыпкой.
      nests = pushToNest(state.board, nests, move.from, move.direction, 'down').nests;
      result = applyLift(state.board, move.from, options);
      break;
    }
  }

  const bonus = longMatchBonus(
    result.matches.map((match) => match.cells.length),
    options.longMatchFrom,
  );
  const mergeBonus = longMergeBonus(result.merges, options.longMerge);
  const groups = result.matches.length + result.merges.length;
  const combo = comboBonus(groups, options.comboFrom);
  purse = grantSwaps(purse, bonus + mergeBonus + combo);
  granted += bonus + mergeBonus + combo;

  return {
    state: { board: result.board, purse, inventory, nests },
    move: result,
    cost,
    granted,
    bonus,
    mergeBonus,
    comboBonus: combo,
    groups,
  };
}

/** Запас кончился — ходить больше нечем, ночь переходит к Рассвету (§2). */
export function isTwilightOver(state: TwilightState): boolean {
  return isExhausted(state.purse);
}
