import { describe, expect, it } from 'vitest';

import {
  DECOR_MARGIN,
  DECOR_STEP,
  WATER_PALETTE,
  WATER_TILE,
  decorKind,
  scatterDecor,
  waterTile,
} from './water';

const PALETTE = new Set<number>(Object.values(WATER_PALETTE));
const share = (pixels: readonly number[], color: number): number =>
  pixels.filter((pixel) => pixel === color).length / pixels.length;

describe('плитка воды', () => {
  it('квадрат нужного размера, только цвета палитры воды', () => {
    const pixels = waterTile();
    expect(pixels).toHaveLength(WATER_TILE * WATER_TILE);
    expect(pixels.every((pixel) => PALETTE.has(pixel))).toBe(true);
  });

  it('на одном сиде — та же вода: не меняется от перезагрузки', () => {
    expect(waterTile({ seed: 3 })).toEqual(waterTile({ seed: 3 }));
    expect(waterTile({ seed: 3 })).not.toEqual(waterTile({ seed: 4 }));
  });

  it('не плоская: все три тона воды заметны', () => {
    const pixels = waterTile({ ripples: 0, sparkles: 0 });
    for (const tone of [WATER_PALETTE.deep, WATER_PALETTE.base, WATER_PALETTE.light]) {
      expect(share(pixels, tone)).toBeGreaterThan(0.1);
    }
  });

  it('рябь и блики есть, но их немного — это вода, а не узор', () => {
    const pixels = waterTile();
    expect(share(pixels, WATER_PALETTE.ripple)).toBeGreaterThan(0);
    expect(share(pixels, WATER_PALETTE.spark)).toBeGreaterThan(0);
    expect(share(pixels, WATER_PALETTE.ripple) + share(pixels, WATER_PALETTE.glint)).toBeLessThan(
      0.05,
    );
  });

  it('без ряби и бликов — только тона воды', () => {
    const pixels = waterTile({ ripples: 0, sparkles: 0 });
    expect(share(pixels, WATER_PALETTE.ripple)).toBe(0);
    expect(share(pixels, WATER_PALETTE.spark)).toBe(0);
  });

  it('бесшовная: края плитки продолжают друг друга', () => {
    // Шум без штрихов: соседние пиксели через шов отличаются не чаще, чем
    // соседние пиксели внутри плитки.
    const size = WATER_TILE;
    const pixels = waterTile({ ripples: 0, sparkles: 0 });
    const tone = (color: number): number =>
      [WATER_PALETTE.deep, WATER_PALETTE.base, WATER_PALETTE.light].indexOf(
        color as typeof WATER_PALETTE.deep,
      );
    const jump = (a: number, b: number): number =>
      Math.abs(tone(pixels[a] as number) - tone(pixels[b] as number));
    let seam = 0;
    let inside = 0;
    for (let y = 0; y < size; y++) {
      seam = Math.max(seam, jump(y * size + size - 1, y * size));
      inside = Math.max(inside, jump(y * size + size / 2 - 1, y * size + size / 2));
    }
    for (let x = 0; x < size; x++) seam = Math.max(seam, jump((size - 1) * size + x, x));
    expect(seam).toBeLessThanOrEqual(Math.max(1, inside));
  });

  it('штрих у края заворачивается на другую сторону, а не обрезается', () => {
    const pixels = waterTile({ size: 8, ripples: 40, sparkles: 6, seed: 1 });
    expect(pixels).toHaveLength(64);
    expect(pixels.every((pixel) => PALETTE.has(pixel))).toBe(true);
  });

  it('крошечная плитка всё равно собирается', () => {
    expect(waterTile({ size: 4, ripples: 0, sparkles: 0 })).toHaveLength(16);
  });
});

describe('камни, кораллы и деревья в воде', () => {
  const FIELD = { x: 0, y: 0, width: 1688, height: 2378 };
  const FRAMES = [
    { name: 'rock-large-1', width: 116, height: 108 },
    { name: 'rock-small-1', width: 80, height: 75 },
    { name: 'coral-1', width: 60, height: 73 },
    { name: 'tree-1', width: 141, height: 367 },
    { name: 'water-sparkle', width: 10, height: 10 },
  ];
  const WIDE = { x: -3000, y: -400, width: 7688, height: 3200 };
  const scatter = (area = WIDE, seed = 11) =>
    scatterDecor({ area, field: FIELD, frames: FRAMES, seed });

  it('вид — по началу имени кадра', () => {
    expect(decorKind('rock-medium-2')).toBe('rock');
    expect(decorKind('coral-3')).toBe('coral');
    expect(decorKind('tree-2')).toBe('tree');
    expect(decorKind('water-sparkle')).toBeNull();
  });

  it('на поле ничего не встаёт: вокруг него остаётся вода', () => {
    for (const placement of scatter()) {
      const frame = FRAMES.find((item) => item.name === placement.frame);
      if (frame === undefined) throw new Error(placement.frame);
      const left = placement.x - frame.width / 2;
      const top = placement.y - frame.height;
      const clear =
        left + frame.width <= FIELD.x - DECOR_MARGIN ||
        left >= FIELD.x + FIELD.width + DECOR_MARGIN ||
        top + frame.height <= FIELD.y - DECOR_MARGIN ||
        top >= FIELD.y + FIELD.height + DECOR_MARGIN;
      expect(clear, placement.frame).toBe(true);
    }
  });

  it('на широком экране — все три вида, камней и кораллов больше, чем деревьев', () => {
    const kinds = scatter().map((placement) => decorKind(placement.frame));
    const count = (kind: string) => kinds.filter((item) => item === kind).length;
    expect(count('tree')).toBeGreaterThan(0);
    expect(count('rock')).toBeGreaterThan(count('tree'));
    expect(count('coral')).toBeGreaterThan(count('tree'));
    expect(kinds).not.toContain(null);
  });

  it('редко: не больше предмета на ячейку, треть ячеек пустая', () => {
    const cells = (WIDE.width / DECOR_STEP) * (WIDE.height / DECOR_STEP);
    expect(scatter().length).toBeLessThan(cells * 0.75);
  });

  it('окно пошире не двигает то, что уже стояло', () => {
    const narrow = { x: -600, y: 0, width: 600, height: 2400 };
    const wide = { x: -1200, y: -200, width: 1800, height: 2800 };
    const before = scatter(narrow);
    const after = scatter(wide);
    expect(before.length).toBeGreaterThan(0);
    for (const placement of before) expect(after).toContainEqual(placement);
  });

  it('на одном сиде — та же расстановка, на другом — другая', () => {
    expect(scatter(WIDE, 5)).toEqual(scatter(WIDE, 5));
    expect(scatter(WIDE, 5)).not.toEqual(scatter(WIDE, 6));
  });

  it('без кадров нужного вида ячейка просто пустеет', () => {
    const rocks = scatterDecor({
      area: WIDE,
      field: FIELD,
      frames: [{ name: 'rock-1', width: 50, height: 50 }],
    });
    expect(rocks.length).toBeGreaterThan(0);
    expect(rocks.every((placement) => placement.frame === 'rock-1')).toBe(true);
  });
});
