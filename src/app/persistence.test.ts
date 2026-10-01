import { describe, expect, it, vi } from 'vitest';

import { boot, newRunSeed } from './persistence';

const picture = (seed?: number) =>
  JSON.stringify(boot(seed === undefined ? { fresh: true } : { fresh: true, seed }).run.board);

describe('сид нового забега', () => {
  it('каждый новый забег — своё поле', () => {
    const boards = new Set(Array.from({ length: 8 }, () => picture()));
    expect(boards.size).toBeGreaterThan(1);
  });

  it('один сид — одно и то же поле: внутри забега всё воспроизводимо', () => {
    expect(picture(42)).toBe(picture(42));
    expect(picture(42)).not.toBe(picture(43));
  });

  it('сид забега попадает в сейв — продолжение идёт тем же потоком', () => {
    const session = boot({ fresh: true, seed: 7 });
    const again = boot({ fresh: true, seed: 7 });
    expect(session.refillRng.snapshot()).toEqual(again.refillRng.snapshot());
  });

  it('целое 32-битное число; без crypto — от времени', () => {
    const seed = newRunSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);

    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Date, 'now').mockReturnValue(123_456);
    expect(newRunSeed()).toBe(123_456);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
