import { describe, expect, it } from 'vitest';

import { DIRECTIONS, STEP, opposite, samePosition, step } from './geometry';

describe('направления', () => {
  it('их четыре — диагоналей в игре нет (§3)', () => {
    expect(DIRECTIONS).toEqual(['up', 'down', 'left', 'right']);
  });

  it('вверх — к цитадели, вниз — к охотникам', () => {
    expect(STEP.up).toEqual({ x: 0, y: -1 });
    expect(STEP.down).toEqual({ x: 0, y: 1 });
  });

  it('каждое направление имеет противоположное', () => {
    expect(opposite('up')).toBe('down');
    expect(opposite('down')).toBe('up');
    expect(opposite('left')).toBe('right');
    expect(opposite('right')).toBe('left');
  });

  it('противоположное к противоположному — оно само', () => {
    for (const direction of DIRECTIONS) {
      expect(opposite(opposite(direction))).toBe(direction);
    }
  });
});

describe('шаг', () => {
  it('сдвигает на клетку', () => {
    expect(step({ x: 2, y: 3 }, 'up')).toEqual({ x: 2, y: 2 });
    expect(step({ x: 2, y: 3 }, 'right')).toEqual({ x: 3, y: 3 });
  });

  it('сдвигает на сколько сказано', () => {
    expect(step({ x: 2, y: 3 }, 'down', 4)).toEqual({ x: 2, y: 7 });
    expect(step({ x: 5, y: 0 }, 'left', 3)).toEqual({ x: 2, y: 0 });
  });

  it('нулевой шаг оставляет на месте', () => {
    expect(step({ x: 2, y: 3 }, 'up', 0)).toEqual({ x: 2, y: 3 });
  });
});

describe('samePosition', () => {
  it('сравнивает по координатам, а не по ссылке', () => {
    expect(samePosition({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
    expect(samePosition({ x: 1, y: 2 }, { x: 2, y: 1 })).toBe(false);
    expect(samePosition({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
});
