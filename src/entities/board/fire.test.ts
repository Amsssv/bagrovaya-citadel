import { describe, expect, it } from 'vitest';

import { boardFrom } from './__testing__/boardFrom';
import { coveredCells } from './fire';
import type { FireSpec } from './fire';

const around = (range: number, shape: 'chebyshev' | 'manhattan' = 'chebyshev'): FireSpec => ({
  pattern: 'around',
  aroundShape: shape,
  range,
  blockedByBuildings: false,
});

const line = (range: number, blockedByBuildings = false): FireSpec => ({
  pattern: 'beam',
  aroundShape: 'chebyshev',
  range,
  blockedByBuildings,
});

const plain = boardFrom(`
  s t a f b
  t a f b s
  a f b s t
  f b s t a
  b s t a f
`);

describe('во все стороны — горгулья (§7)', () => {
  it('радиус 1 накрывает восемь клеток вокруг и свою — как в оригинале', () => {
    expect(coveredCells(plain, { x: 2, y: 2 }, around(1), 'down')).toHaveLength(9);
  });

  it('свою клетку накрывает: враг проходит сквозь горгулью и получает удар', () => {
    const cells = coveredCells(plain, { x: 2, y: 2 }, around(1), 'down');
    expect(cells).toContainEqual({ x: 2, y: 2 });
  });

  it('радиус 2 накрывает двадцать пять клеток', () => {
    expect(coveredCells(plain, { x: 2, y: 2 }, around(2), 'down')).toHaveLength(25);
  });

  it('по четырём сторонам вместо восьми — тоже настройка', () => {
    const cells = coveredCells(plain, { x: 2, y: 2 }, around(1, 'manhattan'), 'down');
    expect(cells).toEqual([
      { x: 2, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
    ]);
  });

  it('в крайнем столбце половина огня уходит за поле — то самое из §7', () => {
    const middle = coveredCells(plain, { x: 2, y: 2 }, around(1), 'down');
    const edge = coveredCells(plain, { x: 0, y: 2 }, around(1), 'down');
    expect(edge.length).toBeLessThan(middle.length);
    expect(edge).toHaveLength(6);
  });

  it('в углу остаётся всего четыре клетки', () => {
    expect(coveredCells(plain, { x: 0, y: 0 }, around(1), 'down')).toHaveLength(4);
  });

  it('направление на круговой огонь не влияет', () => {
    const down = coveredCells(plain, { x: 2, y: 2 }, around(1), 'down');
    const left = coveredCells(plain, { x: 2, y: 2 }, around(1), 'left');
    expect(down).toEqual(left);
  });
});

describe('линия — лоза и мортира', () => {
  it('бьёт по направлению на всю дальность', () => {
    expect(coveredCells(plain, { x: 2, y: 1 }, line(3), 'down')).toEqual([
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
    ]);
  });

  it('вверх, к цитадели', () => {
    expect(coveredCells(plain, { x: 2, y: 2 }, line(2), 'up')).toEqual([
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);
  });

  it('вбок', () => {
    expect(coveredCells(plain, { x: 2, y: 2 }, line(2), 'right')).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ]);
  });

  it('обрывается на краю поля', () => {
    expect(coveredCells(plain, { x: 2, y: 3 }, line(5), 'down')).toEqual([{ x: 2, y: 4 }]);
  });

  it('нулевая дальность — ни одной клетки', () => {
    expect(coveredCells(plain, { x: 2, y: 2 }, line(0), 'down')).toEqual([]);
  });

  it('своя клетка в линию не входит', () => {
    const cells = coveredCells(plain, { x: 2, y: 1 }, line(3), 'down');
    expect(cells).not.toContainEqual({ x: 2, y: 1 });
  });
});

describe('чистая линия огня — только у мортиры (§7)', () => {
  const withBuilding = boardFrom(`
    s t a f b
    t a f b s
    a f G s t
    f b s t a
    b s t a f
  `);

  it('постройка на пути обрывает линию и сама под удар не попадает', () => {
    expect(coveredCells(withBuilding, { x: 2, y: 0 }, line(4, true), 'down')).toEqual([
      { x: 2, y: 1 },
    ]);
  });

  it('без требования чистой линии постройка не мешает', () => {
    expect(coveredCells(withBuilding, { x: 2, y: 0 }, line(4, false), 'down')).toHaveLength(4);
  });

  it('потир перекрывает так же, как постройка', () => {
    const withPotion = boardFrom(`
      s t a f b
      t a f b s
      a f P s t
      f b s t a
      b s t a f
    `);
    expect(coveredCells(withPotion, { x: 2, y: 0 }, line(4, true), 'down')).toEqual([
      { x: 2, y: 1 },
    ]);
  });

  it('сырые плитки не перекрывают: поле после досыпки всегда полное', () => {
    expect(coveredCells(plain, { x: 2, y: 0 }, line(4, true), 'down')).toHaveLength(4);
  });

  it('пустая клетка не перекрывает', () => {
    const withHole = boardFrom(`
      s t a f b
      t a f b s
      a f . s t
      f b s t a
      b s t a f
    `);
    expect(coveredCells(withHole, { x: 2, y: 0 }, line(4, true), 'down')).toHaveLength(4);
  });

  it('постройка вплотную не даёт выстрелить вовсе', () => {
    expect(coveredCells(withBuilding, { x: 2, y: 1 }, line(3, true), 'down')).toEqual([]);
  });
});

describe('туман не стреляет', () => {
  it('накрывает ноль клеток при любой дальности', () => {
    const fog: FireSpec = {
      pattern: 'none',
      aroundShape: 'chebyshev',
      range: 3,
      blockedByBuildings: false,
    };
    expect(coveredCells(plain, { x: 2, y: 2 }, fog, 'down')).toEqual([]);
  });
});

const whole = (pattern: 'column' | 'row'): FireSpec => ({
  pattern,
  aroundShape: 'chebyshev',
  // Дальность у «всей линии» не действует: берётся вся линия поля.
  range: 1,
  blockedByBuildings: false,
});

const walled = boardFrom(`
  s t a f b
  t G f b s
  a f V s t
  f b G t a
  b s t a f
`);

describe('весь столбец — хищная лоза', () => {
  it('накрывает столбец целиком, вверх и вниз, вместе со своей клеткой', () => {
    const cells = coveredCells(plain, { x: 2, y: 2 }, whole('column'), 'down');
    expect(cells).toHaveLength(5);
    expect(cells.every((cell) => cell.x === 2)).toBe(true);
    expect(cells).toContainEqual({ x: 2, y: 0 });
    expect(cells).toContainEqual({ x: 2, y: 4 });
    // Охотник проходит сквозь постройку — и в её клетке тоже получает удар.
    expect(cells).toContainEqual({ x: 2, y: 2 });
  });

  it('постройки на пути не мешают', () => {
    const cells = coveredCells(walled, { x: 2, y: 2 }, whole('column'), 'down');
    expect(cells).toHaveLength(5);
  });

  it('дальность не режет линию', () => {
    expect(coveredCells(plain, { x: 2, y: 0 }, whole('column'), 'up')).toHaveLength(5);
  });
});

describe('весь ряд — пепельная мортира', () => {
  it('накрывает ряд целиком, влево и вправо, вместе со своей клеткой', () => {
    const cells = coveredCells(plain, { x: 2, y: 2 }, whole('row'), 'down');
    expect(cells).toHaveLength(5);
    expect(cells.every((cell) => cell.y === 2)).toBe(true);
    expect(cells).toContainEqual({ x: 0, y: 2 });
    expect(cells).toContainEqual({ x: 4, y: 2 });
    expect(cells).toContainEqual({ x: 2, y: 2 });
  });

  it('постройки на пути не мешают', () => {
    expect(coveredCells(walled, { x: 0, y: 1 }, whole('row'), 'right')).toHaveLength(5);
  });
});
