import { describe, expect, it } from 'vitest';

import { facingOf } from './facing';
import { EMPTY, building } from './types';

describe('куда смотрит постройка', () => {
  const mortar = building('mortar', 'raw');

  it('по умолчанию вправо, у двух правых столбцов — влево', () => {
    expect(facingOf(mortar, 0, 6)).toBe('right');
    expect(facingOf(mortar, 3, 6)).toBe('right');
    expect(facingOf(mortar, 4, 6)).toBe('left');
    expect(facingOf(mortar, 5, 6)).toBe('left');
  });

  it('развёрнутая — куда развернули, где бы ни стояла', () => {
    expect(facingOf({ ...mortar, facing: 'left' }, 0, 6)).toBe('left');
    expect(facingOf({ ...mortar, facing: 'right' }, 5, 6)).toBe('right');
  });

  it('пустая клетка подчиняется тому же правилу края', () => {
    expect(facingOf(EMPTY, 5, 6)).toBe('left');
  });
});
