import type { Position } from '@/shared/lib/geometry';

/**
 * Мост координат между полем и канвасом. Через него React ставит подсказки над
 * нужной клеткой, а Phaser понимает, куда попал палец.
 *
 * Сцена собрана как в оригинале: цитадель сверху, под ней поле с сеткой,
 * охотники приходят снизу и идут вверх (§2, §4). Цитадель — часть картинки
 * поля (её кладут поверх по пикселям картинки), поэтому раскладка ставит
 * только поле целиком и садит сетку **ровно на клетки картинки**.
 *
 * Считается чистой математикой и потому проверяется тестами — в отличие от
 * всего остального в сцене.
 */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface BoardSize {
  readonly width: number;
  readonly height: number;
}

export interface BoardLayout {
  readonly cellSize: number;
  readonly originX: number;
  readonly originY: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Где на картинке помоста лежит сетка — доли от её размеров. */
export interface GridInset {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface ArtSize {
  readonly width: number;
  readonly height: number;
}

export interface SceneLayout extends BoardLayout {
  /** Картинка поля целиком: земля, сетка, место под цитадель. */
  readonly art: Rect;
}

export interface SceneOptions {
  readonly viewport: Viewport;
  readonly board: BoardSize;
  readonly art: ArtSize & { readonly inset: GridInset };
  /**
   * Сколько снизу экрана оставить под подвал: поле туда не заходит, там
   * только облака. Шапка, наоборот, лежит поверх замка — как в оригинале.
   */
  readonly reserveBottom?: number;
}

/** Вписать сетку в прямоугольник: клетка квадратная, сетка по центру. */
export function fitGrid(box: Rect, board: BoardSize): BoardLayout {
  const cellSize = Math.min(box.width / board.width, box.height / board.height);
  return {
    cellSize,
    originX: box.x + (box.width - cellSize * board.width) / 2,
    originY: box.y + (box.height - cellSize * board.height) / 2,
  };
}

/**
 * Поле целиком, без растяжения — перекошенная сетка не сядет на клетки, — и
 * как в оригинале: вплотную к верху экрана, по центру по горизонтали. На
 * телефоне поле упирается в ширину, и весь запас по высоте уходит вниз, под
 * облака; в широком окне — в высоту над подвалом.
 */
export function computeSceneLayout(options: SceneOptions): SceneLayout {
  const { viewport, board, art, reserveBottom = 0 } = options;

  const scale = Math.min(
    viewport.width / art.width,
    Math.max(0, viewport.height - reserveBottom) / art.height,
  );
  const artRect: Rect = {
    x: (viewport.width - art.width * scale) / 2,
    y: 0,
    width: art.width * scale,
    height: art.height * scale,
  };

  const layout = fitGrid(
    {
      x: artRect.x + artRect.width * art.inset.left,
      y: artRect.y + artRect.height * art.inset.top,
      width: artRect.width * (1 - art.inset.left - art.inset.right),
      height: artRect.height * (1 - art.inset.top - art.inset.bottom),
    },
    board,
  );

  return { ...layout, art: artRect };
}

/** Точка картинки поля (в её пикселях) — на экране. */
export function artToScreen(
  layout: SceneLayout,
  art: ArtSize,
  point: { x: number; y: number },
): { x: number; y: number } {
  const scale = layout.art.width / art.width;
  return { x: layout.art.x + point.x * scale, y: layout.art.y + point.y * scale };
}

/** Центр клетки в пикселях канваса. */
export function cellToScreen(layout: BoardLayout, cell: Position): { x: number; y: number } {
  return {
    x: layout.originX + (cell.x + 0.5) * layout.cellSize,
    y: layout.originY + (cell.y + 0.5) * layout.cellSize,
  };
}

/** Клетка под точкой или null, если точка мимо поля. */
export function screenToCell(
  layout: BoardLayout,
  point: { x: number; y: number },
  board: BoardSize,
): Position | null {
  const x = Math.floor((point.x - layout.originX) / layout.cellSize);
  const y = Math.floor((point.y - layout.originY) / layout.cellSize);
  if (x < 0 || x >= board.width || y < 0 || y >= board.height) return null;
  return { x, y };
}

/**
 * Облака под полем. У оригинала задняя полоса — на две клетки ниже сетки, там
 * кончается его поле; наше ниже сетки короче, поэтому полоса — на клетку
 * ниже, сразу под каменной кромкой, и прячет край картинки. Передняя, как в
 * оригинале, на 22 точки ниже задней — в точках арта облаков, поэтому масштаб
 * — клетка экрана к клетке арта.
 */
export const CLOUD_BELOW_GRID = 1;
export const CLOUD_FRONT_OFFSET = 22;

export interface CloudBands {
  /** Во сколько раз увеличить арт облаков. */
  readonly scale: number;
  /** Верх задней полосы на экране. */
  readonly back: number;
  /** Верх передней полосы. */
  readonly front: number;
}

export function cloudBands(layout: BoardLayout, board: BoardSize, artCell: number): CloudBands {
  const scale = layout.cellSize / artCell;
  const back = layout.originY + (board.height + CLOUD_BELOW_GRID) * layout.cellSize;
  return { scale, back, front: back + CLOUD_FRONT_OFFSET * scale };
}
