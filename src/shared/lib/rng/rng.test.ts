import { describe, expect, it } from 'vitest';

import { createRng, restoreRng, STREAMS } from './index';

/** Снять n значений подряд — короткая запись для сравнения последовательностей. */
function take(rng: { next(): number }, n: number): number[] {
  return Array.from({ length: n }, () => rng.next());
}

describe('createRng', () => {
  it('на одном сиде даёт одну и ту же последовательность', () => {
    expect(take(createRng(42), 10)).toEqual(take(createRng(42), 10));
  });

  it('на разных сидах даёт разные последовательности', () => {
    expect(take(createRng(42), 10)).not.toEqual(take(createRng(43), 10));
  });

  it('next() лежит в [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('сид 0 работает как любой другой, а не вырождается в константу', () => {
    const values = take(createRng(0), 10);
    expect(new Set(values).size).toBe(10);
  });
});

describe('int', () => {
  it('лежит в [min, max)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.int(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(9);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('достаёт оба края диапазона', () => {
    const rng = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(0, 6));
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('на диапазоне из одного значения всегда возвращает его', () => {
    const rng = createRng(3);
    for (let i = 0; i < 100; i++) expect(rng.int(4, 5)).toBe(4);
  });

  it('распределён равномерно — перекос ломает баланс волн и досыпки', () => {
    const rng = createRng(123);
    const buckets = [0, 0, 0, 0, 0, 0];
    const draws = 60_000;
    for (let i = 0; i < draws; i++) {
      const bucket = rng.int(0, 6);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    const expected = draws / 6;
    for (const count of buckets) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.05);
    }
  });

  it('пустой диапазон — ошибка, а не молчаливый NaN', () => {
    expect(() => createRng(1).int(5, 5)).toThrow();
  });
});

describe('pick', () => {
  it('возвращает элемент массива', () => {
    const items = ['камень', 'терновник', 'прах', 'туман', 'кровь'] as const;
    const rng = createRng(9);
    for (let i = 0; i < 500; i++) expect(items).toContain(rng.pick(items));
  });

  it('за 500 попыток достаёт каждый элемент хотя бы раз', () => {
    const items = [0, 1, 2, 3, 4];
    const rng = createRng(11);
    const seen = new Set(Array.from({ length: 500 }, () => rng.pick(items)));
    expect(seen.size).toBe(items.length);
  });

  it('на пустом массиве бросает', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});

describe('shuffle', () => {
  it('возвращает перестановку, не теряя и не дублируя элементы', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createRng(5).shuffle(source);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(source);
  });

  it('не трогает исходный массив', () => {
    const source = [1, 2, 3, 4, 5];
    const copy = [...source];
    createRng(5).shuffle(source);
    expect(source).toEqual(copy);
  });

  it('на одном сиде даёт одну и ту же перестановку', () => {
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(createRng(5).shuffle(source)).toEqual(createRng(5).shuffle(source));
  });

  it('вообще что-то перемешивает', () => {
    const source = Array.from({ length: 20 }, (_, i) => i);
    expect(createRng(5).shuffle(source)).not.toEqual(source);
  });
});

describe('fork — независимые потоки', () => {
  it('один сид и один salt дают одну последовательность', () => {
    expect(take(createRng(1).fork('wave'), 10)).toEqual(take(createRng(1).fork('wave'), 10));
  });

  it('разные salt дают разные последовательности', () => {
    expect(take(createRng(1).fork('wave'), 10)).not.toEqual(take(createRng(1).fork('refill'), 10));
  });

  it('поток не совпадает с родителем', () => {
    expect(take(createRng(1).fork('wave'), 10)).not.toEqual(take(createRng(1), 10));
  });

  it('salt зависит от сида: один salt на разных сидах даёт разное', () => {
    expect(take(createRng(1).fork('wave'), 10)).not.toEqual(take(createRng(2).fork('wave'), 10));
  });

  it('поток не зависит от того, сколько раз крутили родителя', () => {
    // Ради этого всё и затевалось: правка, добавившая вызовов в одном месте,
    // не должна сдвигать последовательность в другом.
    const parent = createRng(1);
    const before = take(parent.fork('wave'), 10);
    take(parent, 100);
    expect(take(parent.fork('wave'), 10)).toEqual(before);
  });

  it('вызовы в одном потоке не сдвигают другой', () => {
    const reference = take(createRng(1).fork('wave'), 10);

    const rng = createRng(1);
    const wave = rng.fork('wave');
    const refill = rng.fork('refill');
    const interleaved: number[] = [];
    for (let i = 0; i < 10; i++) {
      take(refill, 3); // посторонний поток крутится как хочет
      interleaved.push(wave.next());
    }

    expect(interleaved).toEqual(reference);
  });

  it('форк форка тоже независим и воспроизводим', () => {
    expect(take(createRng(1).fork('wave').fork('boss'), 10)).toEqual(
      take(createRng(1).fork('wave').fork('boss'), 10),
    );
    expect(take(createRng(1).fork('wave').fork('boss'), 10)).not.toEqual(
      take(createRng(1).fork('boss'), 10),
    );
  });
});

describe('STREAMS', () => {
  it('имена потоков уникальны', () => {
    expect(new Set(STREAMS).size).toBe(STREAMS.length);
  });

  it('каждое имя даёт свою последовательность', () => {
    const rng = createRng(777);
    const heads = STREAMS.map((name) => rng.fork(name).next());
    expect(new Set(heads).size).toBe(STREAMS.length);
  });
});

describe('снимок потока', () => {
  it('восстановленный поток продолжает с того же места', () => {
    const rng = createRng(42);
    take(rng, 5);
    const snapshot = rng.snapshot();

    const expected = take(rng, 10);
    expect(take(restoreRng(snapshot), 10)).toEqual(expected);
  });

  it('снимок в начале равен свежему потоку', () => {
    expect(take(restoreRng(createRng(7).snapshot()), 10)).toEqual(take(createRng(7), 10));
  });

  it('снимок не двигает поток, с которого снят', () => {
    const rng = createRng(3);
    const before = take(createRng(3), 5);
    rng.snapshot();
    expect(take(rng, 5)).toEqual(before);
  });

  it('снимок помнит сид, поэтому форки после восстановления те же', () => {
    const rng = createRng(11);
    take(rng, 3);
    const restored = restoreRng(rng.snapshot());
    expect(take(restored.fork('wave'), 5)).toEqual(take(rng.fork('wave'), 5));
  });

  it('снимок форка восстанавливается отдельно от родителя', () => {
    const parent = createRng(5);
    const wave = parent.fork('wave');
    take(wave, 4);
    const snapshot = wave.snapshot();

    const expected = take(wave, 6);
    expect(take(restoreRng(snapshot), 6)).toEqual(expected);
  });

  it('снимок — простые числа: его можно положить в сохранение', () => {
    const snapshot = createRng(9).snapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(Number.isInteger(snapshot.seed)).toBe(true);
    expect(Number.isInteger(snapshot.state)).toBe(true);
  });
});
