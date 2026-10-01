import { describe, expect, it, vi } from 'vitest';

import { createPool } from './pool';

interface Thing {
  id: number;
  live: boolean;
}

function things() {
  let next = 0;
  return createPool<Thing>(
    () => ({ id: next++, live: true }),
    (item) => {
      item.live = false;
    },
  );
}

describe('пул объектов', () => {
  it('на пустом пуле создаёт новый', () => {
    const pool = things();
    expect(pool.acquire().id).toBe(0);
    expect(pool.size).toBe(1);
  });

  it('возвращённый объект переиспользуется, а не создаётся заново', () => {
    const pool = things();
    const first = pool.acquire();
    pool.release(first);
    expect(pool.acquire()).toBe(first);
    expect(pool.size).toBe(1);
  });

  it('пока объект занят, выдаётся другой', () => {
    const pool = things();
    expect(pool.acquire()).not.toBe(pool.acquire());
    expect(pool.size).toBe(2);
  });

  it('при возврате объект гасится', () => {
    const pool = things();
    const item = pool.acquire();
    pool.release(item);
    expect(item.live).toBe(false);
  });

  it('считает занятые', () => {
    const pool = things();
    const a = pool.acquire();
    pool.acquire();
    expect(pool.active).toBe(2);
    pool.release(a);
    expect(pool.active).toBe(1);
  });

  it('releaseAll возвращает всё разом', () => {
    const pool = things();
    pool.acquire();
    pool.acquire();
    pool.releaseAll();
    expect(pool.active).toBe(0);
    expect(pool.size).toBe(2);
  });

  it('activeItems — снимок занятого, который не меняется от возврата', () => {
    const pool = things();
    const a = pool.acquire();
    const b = pool.acquire();
    const items = pool.activeItems();
    pool.release(a);
    expect(items).toEqual([a, b]);
    expect(pool.activeItems()).toEqual([b]);
  });

  it('повторный возврат того же объекта пул не портит', () => {
    const pool = things();
    const item = pool.acquire();
    pool.release(item);
    pool.release(item);
    expect(pool.size).toBe(1);
    expect(pool.acquire()).toBe(item);
    expect(pool.active).toBe(1);
  });

  it('гасилка зовётся ровно один раз на возврат', () => {
    const reset = vi.fn();
    const pool = createPool(() => ({}), reset);
    const item = pool.acquire();
    pool.release(item);
    pool.release(item);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
