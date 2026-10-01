import { describe, expect, it } from 'vitest';

import {
  artToScreen,
  cellToScreen,
  cloudBands,
  computeSceneLayout,
  fitGrid,
  screenToCell,
} from './layout';

const BOARD = { width: 6, height: 6 };

/** Настоящие доли сетки внутри `field.webp`: клетки по 200 точек. */
const ART = {
  width: 1688,
  height: 2378,
  inset: { left: 247 / 1688, top: 821 / 2378, right: 241 / 1688, bottom: 357 / 2378 },
};

const scene = (width: number, height: number, reserveBottom = 100) =>
  computeSceneLayout({ viewport: { width, height }, board: BOARD, art: ART, reserveBottom });

describe('вписать сетку в прямоугольник', () => {
  it('клетка квадратная, размер от узкой стороны', () => {
    expect(fitGrid({ x: 0, y: 0, width: 360, height: 700 }, BOARD).cellSize).toBe(60);
  });

  it('сетка стоит по центру прямоугольника', () => {
    const layout = fitGrid({ x: 100, y: 0, width: 600, height: 300 }, BOARD);
    expect(layout.originX + (layout.cellSize * 6) / 2).toBeCloseTo(400);
    expect(layout.originY + (layout.cellSize * 6) / 2).toBeCloseTo(150);
  });

  it('неквадратное поле помещается целиком', () => {
    const narrow = { width: 5, height: 9 };
    const layout = fitGrid({ x: 0, y: 0, width: 400, height: 700 }, narrow);
    expect(layout.cellSize * narrow.width).toBeLessThanOrEqual(400);
    expect(layout.cellSize * narrow.height).toBeLessThanOrEqual(700);
  });
});

describe('раскладка сцены: поле целиком, с цитаделью на картинке', () => {
  it('сетка садится на клетки картинки, а не куда попало', () => {
    const layout = scene(390, 844);
    const gridLeft = layout.art.x + layout.art.width * ART.inset.left;
    const gridTop = layout.art.y + layout.art.height * ART.inset.top;
    const gridWidth = layout.art.width * (1 - ART.inset.left - ART.inset.right);

    expect(layout.originX).toBeGreaterThanOrEqual(gridLeft - 1);
    expect(layout.originY).toBeGreaterThanOrEqual(gridTop - 1);
    expect(layout.cellSize * BOARD.width).toBeLessThanOrEqual(gridWidth + 1);
  });

  it('поле стоит по центру по горизонтали', () => {
    const layout = scene(390, 844);
    expect(layout.art.x + layout.art.width / 2).toBeCloseTo(195);
  });

  it('на телефоне поле во всю ширину экрана, как в оригинале', () => {
    const layout = scene(390, 844);
    expect(layout.art.x).toBeCloseTo(0);
    expect(layout.art.width).toBeCloseTo(390);
  });

  it('поле не растянут: пропорции картинки сохранены', () => {
    const layout = scene(390, 844);
    expect(layout.art.width / layout.art.height).toBeCloseTo(ART.width / ART.height);
  });

  it('в низком окне поле упирается в высоту и не заходит под подвал', () => {
    const layout = scene(390, 420);
    expect(layout.art.y + layout.art.height).toBeCloseTo(420 - 100);
    expect(layout.art.x + layout.art.width / 2).toBeCloseTo(195);
  });

  it('поле вплотную к верху экрана, весь запас — снизу, под облака', () => {
    expect(scene(390, 844).art.y).toBe(0);
    expect(scene(1280, 720).art.y).toBe(0);
  });

  it('подвал выше экрана — поле не выворачивается наизнанку', () => {
    expect(scene(390, 50).art.height).toBe(0);
  });

  it('без запаса под подвал поле может дойти до низа', () => {
    const layout = computeSceneLayout({
      viewport: { width: 390, height: 420 },
      board: BOARD,
      art: ART,
    });
    expect(layout.art.height).toBeCloseTo(420);
  });

  it('клетка картинки — 200 точек: сетка садится на неё ровно', () => {
    const layout = scene(390, 844);
    expect(layout.cellSize).toBeCloseTo((200 * layout.art.width) / ART.width);
  });
});

describe('точка картинки поля → экран', () => {
  it('углы картинки — углы её прямоугольника на экране', () => {
    const layout = scene(390, 844);
    expect(artToScreen(layout, ART, { x: 0, y: 0 })).toEqual({ x: layout.art.x, y: layout.art.y });
    const corner = artToScreen(layout, ART, { x: ART.width, y: ART.height });
    expect(corner.x).toBeCloseTo(layout.art.x + layout.art.width);
    expect(corner.y).toBeCloseTo(layout.art.y + layout.art.height);
  });

  it('угол сетки на картинке — начало сетки на экране', () => {
    const layout = scene(390, 844);
    const grid = artToScreen(layout, ART, { x: 247, y: 821 });
    expect(grid.x).toBeCloseTo(layout.originX, 0);
    expect(grid.y).toBeCloseTo(layout.originY, 0);
  });
});

describe('клетка → экран', () => {
  const layout = fitGrid({ x: 0, y: 0, width: 600, height: 600 }, BOARD);

  it('даёт центр клетки, а не её угол', () => {
    expect(cellToScreen(layout, { x: 0, y: 0 })).toEqual({ x: 50, y: 50 });
    expect(cellToScreen(layout, { x: 5, y: 5 })).toEqual({ x: 550, y: 550 });
  });

  it('соседние клетки отстоят ровно на размер клетки', () => {
    const a = cellToScreen(layout, { x: 2, y: 3 });
    const b = cellToScreen(layout, { x: 3, y: 3 });
    expect(b.x - a.x).toBe(layout.cellSize);
  });
});

describe('экран → клетка', () => {
  const layout = scene(390, 844);

  it('обратная к cellToScreen на всех клетках', () => {
    for (let y = 0; y < BOARD.height; y++) {
      for (let x = 0; x < BOARD.width; x++) {
        const point = cellToScreen(layout, { x, y });
        expect(screenToCell(layout, point, BOARD)).toEqual({ x, y });
      }
    }
  });

  it('точка левее и правее поля — мимо', () => {
    expect(screenToCell(layout, { x: 0, y: 500 }, BOARD)).toBeNull();
    expect(screenToCell(layout, { x: 389, y: 500 }, BOARD)).toBeNull();
  });

  it('точка выше и ниже поля — мимо', () => {
    expect(screenToCell(layout, { x: 195, y: 0 }, BOARD)).toBeNull();
    expect(screenToCell(layout, { x: 195, y: 843 }, BOARD)).toBeNull();
  });

  it('левый верхний угол поля попадает в первую клетку', () => {
    expect(screenToCell(layout, { x: layout.originX, y: layout.originY }, BOARD)).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe('облака под полем', () => {
  const layout = { cellSize: 96, originX: 0, originY: 100 };

  it('задняя полоса — на клетку ниже сетки, под каменной кромкой поля', () => {
    expect(cloudBands(layout, BOARD, 48).back).toBe(100 + 7 * 96);
  });

  it('облака закрывают низ картинки поля: вода под сеткой — почти две клетки', () => {
    const scene = computeSceneLayout({
      viewport: { width: 390, height: 844 },
      board: BOARD,
      art: ART,
    });
    const bands = cloudBands(scene, BOARD, 48);
    expect(bands.back).toBeLessThan(scene.art.y + scene.art.height);
  });

  it('передняя — на 22 точки арта ниже задней', () => {
    const bands = cloudBands(layout, BOARD, 48);
    expect(bands.scale).toBe(2);
    expect(bands.front - bands.back).toBe(44);
  });

  it('арт под крупную клетку увеличивается меньше', () => {
    expect(cloudBands(layout, BOARD, 96).scale).toBe(1);
  });
});
