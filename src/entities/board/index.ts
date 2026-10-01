export type {
  Board,
  BuildingCell,
  Cell,
  Direction,
  PotionCell,
  Position,
  ResourceId,
  TileCell,
} from './types';
export { EMPTY, HARVEST, building, potion, tile } from './types';

export { cellAt, createEmptyBoard, inBounds, indexAt, positionAt, withCells } from './board';
export { canDropOffEdge, canSwap, dropOffEdge, swap } from './swap';
export { findMatches, matchedIndices } from './match';
export { applyMerges, findMerges } from './merge';
export type { Merge, Mergeable } from './merge';
export { applySealAt, canSealAt } from './seal';
export { coveredCells } from './fire';
export type { FireSpec } from './fire';
export type { Match } from './match';
export { refill, settle, settleAndRefill } from './gravity';
export type { FallMap, SettleResult } from './gravity';
export {
  applyBlast,
  applyEdgeDrop,
  applyLift,
  applyPlacement,
  applyPotionOpen,
  applySeal,
  applySwap,
  applyTeleport,
} from './resolve';
export { blast, canBlast, canPlace, canTeleport, place, teleport } from './tools';
export { canOpenPotion, openPotion } from './potion';
export type { OpenedPotion } from './potion';
export type { MoveResult, MoveStage, ResolveOptions, Spawned } from './resolve';
export { createBoard } from './generate';
export type { GenerateOptions } from './generate';
