import type { Beat } from '@/features/tutorial';
import { focusCells } from '@/features/tutorial';
import type { Direction } from '@/shared/lib/geometry';
import type { SceneLayout } from '@/widgets/board';
import { cellToScreen } from '@/widgets/board';
import type { CoachGesture, CoachRect } from '@/widgets/tutorial';

export interface CoachView {
  readonly hole: CoachRect | null;
  readonly gesture: CoachGesture;
  readonly from?: { x: number; y: number };
  readonly to?: { x: number; y: number };
}

/** Отступ окна подсветки вокруг кнопки отмены. */
const BUTTON_PAD = 6;
/** На сколько окно над клетками шире самих клеток. */
const CELL_PAD = 4;

/** Рука тянет за край — на клетку дальше поля: прочь или в башню. */
const OFF: Readonly<Record<Direction, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Где подсветка обучения и какой жест показывает рука. Ход — окно над его
 * клетками; отмена — окно над кнопкой; бой — одна подсказка, без окна.
 *
 * `undoRect` — где на экране кнопка отмены (null — её нет).
 */
export function coachFor(
  beat: Beat | undefined,
  layout: SceneLayout | null,
  undoRect: CoachRect | null,
): CoachView | null {
  if (beat === undefined) return null;
  if (beat.kind === 'battle') return { hole: null, gesture: 'tap' };
  if (beat.kind === 'undo') {
    if (undoRect === null) return null;
    return {
      hole: {
        x: undoRect.x - BUTTON_PAD,
        y: undoRect.y - BUTTON_PAD,
        width: undoRect.width + BUTTON_PAD * 2,
        height: undoRect.height + BUTTON_PAD * 2,
      },
      gesture: 'tap',
      from: { x: undoRect.x + undoRect.width / 2, y: undoRect.y + undoRect.height / 2 },
    };
  }
  if (beat.kind !== 'move' || layout === null) return null;
  const centres = focusCells(beat).map((cell) => cellToScreen(layout, cell));
  const [first] = centres;
  if (first === undefined) return null;
  const half = layout.cellSize / 2 + CELL_PAD;
  const xs = centres.map((point) => point.x);
  const ys = centres.map((point) => point.y);
  const x = Math.min(...xs) - half;
  const y = Math.min(...ys) - half;
  const hole = { x, y, width: Math.max(...xs) + half - x, height: Math.max(...ys) + half - y };
  const { move } = beat;
  if (move.type === 'swap') {
    return {
      hole,
      gesture: 'drag',
      from: cellToScreen(layout, move.from),
      to: cellToScreen(layout, move.to),
    };
  }
  if (move.type === 'drop' || move.type === 'nest') {
    const [dx, dy] = OFF[move.direction];
    return {
      hole,
      gesture: 'drag',
      from: first,
      to: { x: first.x + dx * layout.cellSize, y: first.y + dy * layout.cellSize },
    };
  }
  return { hole, gesture: 'tap', from: first };
}
