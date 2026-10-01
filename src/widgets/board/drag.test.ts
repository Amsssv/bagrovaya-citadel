import { describe, expect, it } from 'vitest';

import { DRAG_THRESHOLD_PX, dragDirection } from './drag';

const from = { x: 100, y: 100 };

describe('порог перетаскивания', () => {
  it('короткое дрожание пальца ходом не считается', () => {
    expect(dragDirection(from, { x: 105, y: 102 })).toBeNull();
    expect(dragDirection(from, { x: 100, y: 100 })).toBeNull();
  });

  it('порог — двенадцать точек: ниже пальцы промахиваются, выше жест тормозит', () => {
    expect(DRAG_THRESHOLD_PX).toBe(12);
    expect(dragDirection(from, { x: 100 + DRAG_THRESHOLD_PX - 1, y: 100 })).toBeNull();
    expect(dragDirection(from, { x: 100 + DRAG_THRESHOLD_PX, y: 100 })).toBe('right');
  });

  it('порог можно задать отдельно', () => {
    expect(dragDirection(from, { x: 104, y: 100 }, 3)).toBe('right');
  });
});

describe('направление жеста', () => {
  it('четыре стороны', () => {
    expect(dragDirection(from, { x: 130, y: 100 })).toBe('right');
    expect(dragDirection(from, { x: 70, y: 100 })).toBe('left');
    expect(dragDirection(from, { x: 100, y: 70 })).toBe('up');
    expect(dragDirection(from, { x: 100, y: 130 })).toBe('down');
  });

  it('по диагонали побеждает та ось, вдоль которой тянули дальше', () => {
    expect(dragDirection(from, { x: 130, y: 115 })).toBe('right');
    expect(dragDirection(from, { x: 115, y: 130 })).toBe('down');
    expect(dragDirection(from, { x: 70, y: 85 })).toBe('left');
    expect(dragDirection(from, { x: 85, y: 70 })).toBe('up');
  });

  it('при равных смещениях выбор всё равно определённый', () => {
    expect(dragDirection(from, { x: 130, y: 130 })).toBe('right');
    expect(dragDirection(from, { x: 70, y: 70 })).toBe('left');
  });
});
