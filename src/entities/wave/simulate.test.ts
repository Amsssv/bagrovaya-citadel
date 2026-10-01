import { describe, expect, it } from 'vitest';

import { withCells } from '@/entities/board';
import { boardFrom } from '@/entities/board/__testing__/boardFrom';
import type { BuildingBook, BuildingSpec, TierStats } from '@/entities/building';
import { createCitadel } from '@/entities/citadel';
import type { EnemyBook, EnemySpec } from '@/entities/enemy';

import { flockBurst, simulateNight } from './simulate';
import type { NightEvent, SimulateOptions, WaveConfig } from './types';

const NOTHING: TierStats = { damage: 0, shotsPerSecond: 0, range: 0, slowFactor: 0 };

function spec(partial: Partial<BuildingSpec> & { tiers: BuildingSpec['tiers'] }): BuildingSpec {
  return {
    pattern: 'none',
    targets: 'one',
    aroundShape: 'chebyshev',
    defaultFacing: 'down',
    blockedByBuildings: false,
    verified: true,
    ...partial,
  };
}

/** Все ступени одинаковые — в тестах важна схема, а не лестница. */
const sameTiers = (stats: TierStats): BuildingSpec['tiers'] => ({
  raw: stats,
  bone: stats,
  obsidian: stats,
  crimson: stats,
});

const BUILDINGS: BuildingBook = {
  // Бьёт вокруг себя, одну цель, раз в секунду, 5 урона.
  gargoyle: spec({
    pattern: 'around',
    targets: 'one',
    tiers: sameTiers({ damage: 5, shotsPerSecond: 1, range: 1, slowFactor: 0 }),
  }),
  // Одна цель по направлению, далеко.
  vine: spec({
    pattern: 'single',
    targets: 'one',
    tiers: sameTiers({ damage: 4, shotsPerSecond: 1, range: 4, slowFactor: 0 }),
  }),
  // Вся линия сразу.
  mortar: spec({
    pattern: 'beam',
    targets: 'all',
    blockedByBuildings: true,
    tiers: sameTiers({ damage: 3, shotsPerSecond: 1, range: 4, slowFactor: 0 }),
  }),
  // Не стреляет, режет скорость вдвое.
  fogveil: spec({
    pattern: 'none',
    tiers: sameTiers({ damage: 0, shotsPerSecond: 0, range: 0, slowFactor: 0.5 }),
  }),
};

const NOVICE: EnemySpec = { hp: 10, speed: 2, citadelDamage: 4, verified: true };

const ENEMIES: EnemyBook = {
  novice: NOVICE,
  tough: { hp: 100, speed: 2, citadelDamage: 7, verified: true },
  frozen: { hp: 10, speed: 0, citadelDamage: 1, verified: true },
  // Хилый и медленный: гибнет от первого же выстрела — удобно, когда важна
  // цепочка событий, а не живучесть.
  weak: { hp: 1, speed: 1, citadelDamage: 1, verified: true },
  // Живучие: нужны, когда важен выбор цели, а не чья-то смерть.
  tank: { hp: 1000, speed: 2, citadelDamage: 1, verified: true },
  crawler: { hp: 1000, speed: 1, citadelDamage: 1, verified: true },
};

function options(overrides: Partial<SimulateOptions> = {}): SimulateOptions {
  return {
    enemies: ENEMIES,
    buildings: BUILDINGS,
    tickMs: 50,
    maxSeconds: 30,
    ...overrides,
  };
}

const wave = (...spawns: WaveConfig['spawns']): WaveConfig => ({ spawns });

const EMPTY_FIELD = boardFrom(`
  s t a
  t a s
  a s t
  s t a
  t a s
`);

const state = (board = EMPTY_FIELD, hearts = 30) => ({
  board,
  citadel: createCitadel(hearts, 30),
  night: 1,
});

const kinds = (events: readonly NightEvent[], type: NightEvent['type']): NightEvent[] =>
  events.filter((event) => event.type === type);

describe('пустая волна', () => {
  it('ночь заканчивается сразу и считается отбитой', () => {
    const result = simulateNight(state(), wave(), options());
    expect(result.outcome).toBe('cleared');
    expect(result.durationMs).toBe(0);
  });

  it('в логе только конец ночи', () => {
    const result = simulateNight(state(), wave(), options());
    expect(result.events.map((event) => event.type)).toEqual(['end']);
  });

  it('цитадель цела', () => {
    const result = simulateNight(state(), wave(), options());
    expect(result.citadel.hearts).toBe(30);
  });
});

describe('охотник идёт к цитадели', () => {
  const single = wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 });

  it('выходит в свой столбец в назначенное время', () => {
    const result = simulateNight(state(), single, options());
    const spawn = kinds(result.events, 'spawn')[0];
    expect(spawn).toMatchObject({ type: 'spawn', at: 0, id: 'h1', column: 1 });
  });

  it('доходит до цитадели и снимает сердца', () => {
    const result = simulateNight(state(), single, options());
    expect(result.leaked).toBe(1);
    expect(result.killed).toBe(0);
    expect(result.citadel.hearts).toBe(26);
  });

  it('в логе видно, как он переходит из клетки в клетку', () => {
    const result = simulateNight(state(), single, options());
    const moves = kinds(result.events, 'move');
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0]).toMatchObject({ from: 4, to: 3 });
  });

  it('чем быстрее, тем раньше дойдёт', () => {
    const slow = simulateNight(state(), single, options());
    const fast = simulateNight(
      state(),
      single,
      options({ enemies: { ...ENEMIES, novice: { ...NOVICE, speed: 4 } } }),
    );
    expect(fast.durationMs).toBeLessThan(slow.durationMs);
  });

  it('позднее время выхода отодвигает и приход', () => {
    const late = simulateNight(
      state(),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 3 }),
      options(),
    );
    const early = simulateNight(state(), single, options());
    expect(late.durationMs).toBeGreaterThan(early.durationMs);
  });
});

describe('туман замедляет (§4)', () => {
  it('через завесу охотник идёт дольше', () => {
    const withFog = boardFrom(`
      s t a
      t a s
      a W t
      s t a
      t a s
    `);
    const clean = simulateNight(
      state(),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    const fogged = simulateNight(
      state(withFog),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    expect(fogged.durationMs).toBeGreaterThan(clean.durationMs);
  });

  it('вход в туман и выход из него — события: сцена показывает, где держит', () => {
    const withFog = boardFrom(`
      s t a
      t a s
      a W t
      s t a
      t a s
    `);
    const { events } = simulateNight(
      state(withFog),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    const paces = events.flatMap((event) => (event.type === 'pace' ? [event] : []));
    expect(paces.map((event) => event.factor < 1)).toEqual([true, false]);
    // Держит в клетке завесы (ряд 2): вход — у её нижнего края, выход — сразу
    // за верхним. Координата снята после шага тика, поэтому — в пределах
    // одного шага (2 клетки/с × 50 мс = 0,1 клетки) за краем.
    const [enter, leave] = paces;
    expect(enter?.y).toBeLessThanOrEqual(2.5);
    expect(enter?.y).toBeGreaterThan(2.3);
    expect(leave?.y).toBeLessThan(1.5);
    expect(leave?.y).toBeGreaterThan(1.3);
    expect((paces[0]?.at ?? 0) < (paces[1]?.at ?? 0)).toBe(true);
  });

  it('между событиями с координатой охотник не обгоняет свой шаг — и на выходе из тумана', () => {
    // Сцена ведёт спрайт линейно от одной координаты к следующей. Если события
    // снимают координату в разные моменты тика, за выходом из полосы тумана
    // спрайт на миг шёл вдвое быстрее.
    const oneFog = boardFrom(`
      s t a
      t a s
      a W t
      s t a
      t a s
    `);
    const { events } = simulateNight(
      state(oneFog),
      wave({ id: 'h1', kind: 'crawler', column: 1, atSecond: 0 }),
      options({
        buildings: { ...BUILDINGS, fogveil: { ...BUILDINGS.fogveil, slowZone: [0.1, 0.6] } },
      }),
    );
    const marks = events.flatMap((event) =>
      (event.type === 'move' || event.type === 'pace' || event.type === 'leak') && event.id === 'h1'
        ? [{ at: event.at, y: event.y }]
        : [],
    );
    for (let i = 1; i < marks.length; i++) {
      const [a, b] = [marks[i - 1], marks[i]] as [
        { at: number; y: number },
        { at: number; y: number },
      ];
      // В один и тот же миг охотник стоит в одной точке.
      if (b.at === a.at) {
        expect(b.y).toBeCloseTo(a.y, 6);
        continue;
      }
      const speed = ((a.y - b.y) / (b.at - a.at)) * 1000;
      expect(speed).toBeLessThanOrEqual(1.1);
    }
  });

  it('одиночная завеса держит только в своей полосе, как в оригинале', () => {
    const oneFog = boardFrom(`
      s t a
      t a s
      a W t
      s t a
      t a s
    `);
    const { events } = simulateNight(
      state(oneFog),
      wave({ id: 'h1', kind: 'crawler', column: 1, atSecond: 0 }),
      options({
        buildings: { ...BUILDINGS, fogveil: { ...BUILDINGS.fogveil, slowZone: [0.1, 0.6] } },
      }),
    );
    const paces = events.flatMap((event) => (event.type === 'pace' ? [event] : []));
    const [enter, leave] = paces;
    // Полоса ряда 2 — y от 1,6 до 2,1: вход у 2,1, выход у 1,6.
    expect(enter?.y).toBeLessThanOrEqual(2.1);
    expect(enter?.y).toBeGreaterThan(2.0);
    expect(leave?.y).toBeLessThanOrEqual(1.6);
    expect(leave?.y).toBeGreaterThan(1.5);
  });

  it('без тумана событий темпа нет', () => {
    const { events } = simulateNight(
      state(),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    expect(events.some((event) => event.type === 'pace')).toBe(false);
  });

  it('завеса в чужом столбце не мешает', () => {
    const asideFog = boardFrom(`
      s t a
      t a s
      W s t
      s t a
      t a s
    `);
    const clean = simulateNight(
      state(),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    const aside = simulateNight(
      state(asideFog),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    expect(aside.durationMs).toBe(clean.durationMs);
  });
});

describe('постройки стреляют сами', () => {
  const withGargoyle = boardFrom(`
    s t a
    t a s
    a G t
    s t a
    t a s
  `);

  it('горгулья убивает проходящего', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    expect(result.killed).toBe(1);
    expect(result.leaked).toBe(0);
    expect(result.citadel.hearts).toBe(30);
  });

  it('в логе есть выстрел, попадание и смерть', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    expect(kinds(result.events, 'shot').length).toBeGreaterThan(0);
    expect(kinds(result.events, 'hit').length).toBeGreaterThan(0);
    expect(kinds(result.events, 'kill')).toHaveLength(1);
  });

  it('живучего не добивает — он прорывается', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h1', kind: 'tough', column: 1, atSecond: 0 }),
      options(),
    );
    expect(result.killed).toBe(0);
    expect(result.leaked).toBe(1);
  });

  it('без цели не тратит перезарядку: стреляет, едва цель появилась', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 5 }),
      options(),
    );
    const firstShot = kinds(result.events, 'shot')[0];
    const spawn = kinds(result.events, 'spawn')[0];
    expect(firstShot?.at).toBeLessThan((spawn?.at ?? 0) + 1000);
  });

  it('постройка с нулевой скорострельностью молчит', () => {
    const silent: BuildingBook = {
      ...BUILDINGS,
      gargoyle: spec({ pattern: 'around', tiers: sameTiers(NOTHING) }),
    };
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options({ buildings: silent }),
    );
    expect(kinds(result.events, 'shot')).toEqual([]);
    expect(result.leaked).toBe(1);
  });
});

describe('одна цель против всей линии (§7)', () => {
  const twoInColumn = wave(
    { id: 'h1', kind: 'novice', column: 1, atSecond: 0 },
    { id: 'h2', kind: 'novice', column: 1, atSecond: 0 },
  );

  it('лоза бьёт одного за выстрел', () => {
    const withVine = boardFrom(`
      s V a
      t a s
      a s t
      s t a
      t a s
    `);
    const result = simulateNight(state(withVine), twoInColumn, options());
    for (const shot of kinds(result.events, 'shot')) {
      expect(shot.type === 'shot' ? shot.targets.length : 0).toBe(1);
    }
  });

  it('мортира задевает всех в линии сразу', () => {
    const withMortar = boardFrom(`
      s M a
      t a s
      a s t
      s t a
      t a s
    `);
    const result = simulateNight(state(withMortar), twoInColumn, options());
    const multi = kinds(result.events, 'shot').filter(
      (shot) => shot.type === 'shot' && shot.targets.length > 1,
    );
    expect(multi.length).toBeGreaterThan(0);
  });
});

describe('кого выбирает выстрел', () => {
  it('бьёт того, кто ближе к цитадели, даже если вышел позже', () => {
    // Медленный ползёт в столбце 0, быстрый обгоняет его в столбце 2.
    // Горгулья посередине накрывает оба столбца.
    const withGargoyle = boardFrom(`
      s t a
      t a s
      a G t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(withGargoyle),
      wave(
        { id: 'h1', kind: 'crawler', column: 0, atSecond: 0 },
        { id: 'h2', kind: 'tank', column: 2, atSecond: 0 },
      ),
      options(),
    );

    const h2Leaked = result.events.findIndex((event) => event.type === 'leak' && event.id === 'h2');
    const shotsBefore = result.events.slice(0, h2Leaked).filter((event) => event.type === 'shot');

    expect(shotsBefore.length).toBeGreaterThan(0);
    for (const shot of shotsBefore) {
      expect(shot.type === 'shot' ? shot.targets : []).toEqual(['h2']);
    }
  });
});

describe('конец ночи', () => {
  it('цитадель падает — ночь обрывается', () => {
    const result = simulateNight(
      state(EMPTY_FIELD, 4),
      wave(
        { id: 'h1', kind: 'novice', column: 0, atSecond: 0 },
        { id: 'h2', kind: 'novice', column: 2, atSecond: 0 },
      ),
      options(),
    );
    expect(result.outcome).toBe('citadel-fell');
    expect(result.citadel.hearts).toBe(0);
  });

  it('неподвижный охотник упирается в предел расчёта', () => {
    const result = simulateNight(
      state(),
      wave({ id: 'h1', kind: 'frozen', column: 1, atSecond: 0 }),
      options({ maxSeconds: 2 }),
    );
    expect(result.outcome).toBe('timeout');
    expect(result.survivors).toHaveLength(1);
    expect(result.durationMs).toBe(2000);
  });

  it('последнее событие всегда конец ночи', () => {
    const result = simulateNight(
      state(),
      wave({ id: 'h1', kind: 'novice', column: 1, atSecond: 0 }),
      options(),
    );
    expect(result.events.at(-1)?.type).toBe('end');
  });
});

describe('лог как основа анимации', () => {
  const withGargoyle = boardFrom(`
    s t a
    t a s
    a G t
    s t a
    t a s
  `);
  const busy = wave(
    { id: 'h1', kind: 'novice', column: 1, atSecond: 0 },
    { id: 'h2', kind: 'tough', column: 0, atSecond: 1 },
  );

  it('события идут по неубывающему времени', () => {
    const result = simulateNight(state(withGargoyle), busy, options());
    const times = result.events.map((event) => event.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('два прогона одного и того же дают одинаковый лог', () => {
    const first = simulateNight(state(withGargoyle), busy, options());
    const second = simulateNight(state(withGargoyle), busy, options());
    expect(first.events).toEqual(second.events);
  });

  it('исходное состояние не меняется', () => {
    const before = state(withGargoyle);
    const hearts = before.citadel.hearts;
    simulateNight(before, busy, options());
    expect(before.citadel.hearts).toBe(hearts);
  });

  it('неизвестный охотник в волне — ошибка', () => {
    expect(() =>
      simulateNight(
        state(),
        wave({ id: 'h1', kind: 'призрак', column: 0, atSecond: 0 }),
        options(),
      ),
    ).toThrow(/призрак/);
  });
});

describe('паства выходит после смерти проповедника (§10)', () => {
  const withGargoyle = boardFrom(`
    s t a
    t a s
    a G t
    s t a
    t a s
  `);

  const bossWave = wave(
    { id: 'boss', kind: 'novice', column: 1, atSecond: 0 },
    { id: 'flock-1', kind: 'novice', column: 0, atSecond: 0, afterDeathOf: 'boss' },
    { id: 'flock-2', kind: 'novice', column: 2, atSecond: 0, afterDeathOf: 'boss' },
  );

  it('пока проповедник жив, паства не выходит', () => {
    const result = simulateNight(state(withGargoyle), bossWave, options());
    const bossKill = result.events.findIndex(
      (event) => event.type === 'kill' && event.id === 'boss',
    );
    const flockSpawn = result.events.findIndex(
      (event) => event.type === 'spawn' && event.id.startsWith('flock'),
    );
    expect(bossKill).toBeGreaterThanOrEqual(0);
    expect(flockSpawn).toBeGreaterThan(bossKill);
  });

  it('выходит вся — и в его столбце, и в соседних', () => {
    const result = simulateNight(state(withGargoyle), bossWave, options());
    const columns = kinds(result.events, 'spawn')
      .filter((event) => event.type === 'spawn' && event.id.startsWith('flock'))
      .map((event) => (event.type === 'spawn' ? event.column : -1))
      .sort((a, b) => a - b);
    expect(columns).toEqual([0, 2]);
  });

  it('задержка после смерти соблюдается', () => {
    const delayed = wave(
      { id: 'boss', kind: 'novice', column: 1, atSecond: 0 },
      { id: 'flock-1', kind: 'novice', column: 0, atSecond: 2, afterDeathOf: 'boss' },
    );
    const result = simulateNight(state(withGargoyle), delayed, options());
    const kill = kinds(result.events, 'kill').find(
      (event) => event.type === 'kill' && event.id === 'boss',
    );
    const spawn = kinds(result.events, 'spawn').find(
      (event) => event.type === 'spawn' && event.id === 'flock-1',
    );
    expect((spawn?.at ?? 0) - (kill?.at ?? 0)).toBeGreaterThanOrEqual(2000);
  });

  it('ночь не кончается, пока паства ждёт выхода', () => {
    const delayed = wave(
      { id: 'boss', kind: 'novice', column: 1, atSecond: 0 },
      { id: 'flock-1', kind: 'novice', column: 0, atSecond: 3, afterDeathOf: 'boss' },
    );
    const result = simulateNight(state(withGargoyle), delayed, options());
    // Если бы ночь оборвалась сразу после смерти проповедника, паства не вышла
    // бы вовсе — а она вышла, значит расчёт её дождался.
    expect(kinds(result.events, 'spawn')).toHaveLength(2);
    expect(result.outcome).toBe('cleared');
  });

  it('прорвавшийся проповедник паству не выпускает', () => {
    const noDefence = wave(
      { id: 'boss', kind: 'novice', column: 1, atSecond: 0 },
      { id: 'flock-1', kind: 'novice', column: 0, atSecond: 0, afterDeathOf: 'boss' },
    );
    const result = simulateNight(state(), noDefence, options());
    expect(kinds(result.events, 'spawn')).toHaveLength(1);
    expect(result.outcome).toBe('cleared');
  });

  it('паства от паствы — цепочка тоже работает', () => {
    const chain = wave(
      { id: 'boss', kind: 'weak', column: 1, atSecond: 0 },
      { id: 'flock-1', kind: 'weak', column: 1, atSecond: 0, afterDeathOf: 'boss' },
      { id: 'flock-2', kind: 'weak', column: 1, atSecond: 0, afterDeathOf: 'flock-1' },
    );
    const result = simulateNight(state(withGargoyle), chain, options());
    expect(kinds(result.events, 'spawn')).toHaveLength(3);
  });
});

describe('лоза и мортира бьют всю свою линию', () => {
  // Та же книга, но лоза — столбец, мортира — ряд: обе по одной цели, сквозь постройки.
  const LINES: BuildingBook = {
    ...BUILDINGS,
    vine: spec({
      pattern: 'column',
      targets: 'one',
      tiers: sameTiers({ damage: 4, shotsPerSecond: 1, range: 0, slowFactor: 0 }),
    }),
    mortar: spec({
      pattern: 'row',
      targets: 'one',
      tiers: sameTiers({ damage: 4, shotsPerSecond: 1, range: 0, slowFactor: 0 }),
    }),
  };
  const shots = (events: readonly NightEvent[]) =>
    kinds(events, 'shot') as Extract<NightEvent, { type: 'shot' }>[];

  it('лоза у самых ворот достаёт охотника внизу своего столбца — сквозь постройку', () => {
    const board = boardFrom(`
      s V a
      t G s
      a s t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(board),
      wave({ id: 'h1', kind: 'tank', column: 1, atSecond: 0 }),
      options({ buildings: LINES }),
    );
    const first = shots(result.events).find((shot) => shot.from.y === 0);
    expect(first?.targets).toEqual(['h1']);
    expect(first?.at).toBe(0);
  });

  it('лоза не бьёт соседний столбец', () => {
    const board = boardFrom(`
      s V a
      t a s
      a s t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(board),
      wave({ id: 'h1', kind: 'tank', column: 2, atSecond: 0 }),
      options({ buildings: LINES }),
    );
    expect(shots(result.events)).toHaveLength(0);
  });

  it('мортира бьёт того, кто проходит её ряд, с любого края', () => {
    const board = boardFrom(`
      s t a
      t a s
      M G t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(board),
      wave({ id: 'h1', kind: 'tank', column: 2, atSecond: 0 }),
      options({ buildings: LINES }),
    );
    const mortar = shots(result.events).filter((shot) => shot.from.x === 0 && shot.from.y === 2);
    expect(mortar.length).toBeGreaterThan(0);
    expect(mortar.every((shot) => shot.targets.length === 1)).toBe(true);
  });

  it('из двоих в линии — ближайший к воротам', () => {
    const board = boardFrom(`
      s t a
      t a s
      a s t
      s t a
      t V s
    `);
    const result = simulateNight(
      state(board),
      wave(
        { id: 'slow', kind: 'crawler', column: 1, atSecond: 0 },
        { id: 'fast', kind: 'tank', column: 1, atSecond: 0 },
      ),
      options({ buildings: LINES }),
    );
    const later = shots(result.events).filter((shot) => shot.at >= 1000);
    expect(later[0]?.targets).toEqual(['fast']);
  });
});

describe('враги в ночь N', () => {
  const grower: EnemySpec = {
    hp: 1,
    hpPerNight: 1,
    speed: 1,
    speedGrowthPerNight: 1,
    citadelDamage: 1,
    verified: false,
  };
  const withGrower = options({ enemies: { ...ENEMIES, grower } });
  const at = (night: number, board = EMPTY_FIELD) => ({ ...state(board), night });

  it('к поздней ночи враг идёт быстрее: доходит раньше', () => {
    const walk = (night: number) =>
      simulateNight(
        at(night),
        wave({ id: 'g', kind: 'grower', column: 0, atSecond: 0 }),
        withGrower,
      ).durationMs;
    expect(walk(3)).toBeLessThan(walk(1));
  });

  it('жизни берутся на эту ночь: в пятую у врага их шесть', () => {
    const withGargoyle = boardFrom(`
      s t a
      t a s
      a G t
      s t a
      t a s
    `);
    const result = simulateNight(
      at(5, withGargoyle),
      wave({ id: 'g', kind: 'grower', column: 1, atSecond: 0 }),
      withGrower,
    );
    const hit = kinds(result.events, 'hit')[0];
    expect(hit?.type === 'hit' ? hit.hpLeft + hit.amount : 0).toBe(6);
  });
});

describe('побеждённые боссы', () => {
  it('считаются отдельно от прочих убитых', () => {
    const withGargoyles = boardFrom(`
      s t a
      t a s
      a G t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(withGargoyles),
      wave(
        { id: 'boss', kind: 'weak', column: 1, atSecond: 0, boss: true },
        { id: 'h', kind: 'weak', column: 1, atSecond: 3 },
      ),
      options(),
    );
    expect(result.killed).toBe(2);
    expect(result.bossesKilled).toBe(1);
  });
});

describe('башни замка стреляют (гнёзда)', () => {
  const nests = (cell = { kind: 'building', building: 'gargoyle', tier: 'raw' } as const) => ({
    slots: [{ id: 'left', from: { x: 0, y: 0 }, direction: 'up' as const }],
    occupied: { left: { cell, facing: 'down' as const } },
  });
  const run = (range: number | undefined, column: number, withTower = true) =>
    simulateNight(
      { ...state(), nests: withTower ? nests() : undefined },
      wave({ id: 'h', kind: 'novice', column, atSecond: 0 }),
      options({ turretRange: range }),
    );

  it('горгулья в башне стреляет по проходящим у стены', () => {
    expect(kinds(run(2, 0).events, 'shot').length).toBeGreaterThan(0);
  });

  it('без башни у стены никто не стреляет', () => {
    expect(kinds(run(2, 0, false).events, 'shot')).toEqual([]);
  });

  it('башня бьёт на два столбца в сторону — дальше, чем горгулья на поле', () => {
    expect(kinds(run(2, 2).events, 'shot').length).toBeGreaterThan(0);
    expect(kinds(run(1, 2).events, 'shot')).toEqual([]);
  });

  it('выстрел идёт из клетки над полем', () => {
    const shot = kinds(run(2, 0).events, 'shot')[0];
    expect(shot?.type === 'shot' ? shot.from : null).toEqual({ x: 0, y: -1 });
  });
});

describe('башни замка без горгульи', () => {
  const slots = [{ id: 'left', from: { x: 0, y: 0 }, direction: 'up' as const }];
  const run = (occupied: Record<string, { cell: never; facing: 'down' }> | object) =>
    simulateNight(
      { ...state(), nests: { slots, occupied } as never },
      wave({ id: 'h', kind: 'novice', column: 0, atSecond: 0 }),
      options({ turretRange: 2 }),
    );

  it('пустая башня не стреляет', () => {
    expect(kinds(run({}).events, 'shot')).toEqual([]);
  });

  it('башня, в которой не постройка, не стреляет', () => {
    const tile = { left: { cell: { kind: 'tile', resource: 'stone' }, facing: 'down' } };
    expect(kinds(run(tile).events, 'shot')).toEqual([]);
  });
});

describe('правила оригинала: выбор цели', () => {
  const two = (a: number, b: number) =>
    wave(
      { id: 'near', kind: 'tank', column: a, atSecond: 0 },
      { id: 'far', kind: 'tank', column: b, atSecond: 0 },
    );
  const firstTarget = (board: string, book: BuildingBook, spawns: WaveConfig) => {
    const result = simulateNight(state(boardFrom(board)), spawns, options({ buildings: book }));
    const shot = kinds(result.events, 'shot')[0];
    return shot?.type === 'shot' ? shot.targets[0] : null;
  };

  it('nearest: горгулья бьёт ближайшего к себе, а не к воротам', () => {
    const book: BuildingBook = {
      ...BUILDINGS,
      gargoyle: { ...BUILDINGS.gargoyle, targeting: 'nearest' },
    };
    // Горгулья в правом столбце: враг в её столбце ближе, чем в соседнем.
    expect(
      firstTarget(
        `
        s t a
        t a s
        a s t
        s t G
        t a s
      `,
        book,
        two(2, 1),
      ),
    ).toBe('near');
  });

  it('horizontal: мортира сама бьёт ближайшего по ряду — хоть слева, хоть справа', () => {
    const rowBook: BuildingBook = {
      ...BUILDINGS,
      mortar: spec({
        pattern: 'row',
        targets: 'one',
        targeting: 'horizontal',
        tiers: sameTiers({ damage: 1, shotsPerSecond: 1, range: 5, slowFactor: 0 }),
      }),
    };
    const board = `
      s t a f b
      t a s b f
      a s t f b
      s t a b f
      t a s M b
    `;
    // Мортира в четвёртом столбце. Ближний слева, дальний ещё левее — бьёт
    // влево.
    expect(firstTarget(board, rowBook, two(2, 0))).toBe('near');
    // Ближний справа, дальний слева — бьёт вправо, без разворота тапом.
    expect(firstTarget(board, rowBook, two(4, 0))).toBe('near');
  });

  it('facing: мортира бьёт в ту сторону, куда смотрит', () => {
    const rowBook: BuildingBook = {
      ...BUILDINGS,
      mortar: spec({
        pattern: 'row',
        targets: 'one',
        targeting: 'facing',
        tiers: sameTiers({ damage: 1, shotsPerSecond: 1, range: 5, slowFactor: 0 }),
      }),
    };
    // Поле в пять столбцов: мортира во втором смотрит вправо (влево смотрят
    // только поставленные в двух крайних правых). Враги по обе стороны — на
    // одинаковом расстоянии; она выбирает того, что справа.
    const board = `
      s t a f b
      t a s b f
      a s t f b
      s t a b f
      t M s f b
    `;
    expect(firstTarget(board, rowBook, two(2, 0))).toBe('near');
  });

  it('facing: развёрнутая влево мортира бьёт влево', () => {
    const rowBook: BuildingBook = {
      ...BUILDINGS,
      mortar: spec({
        pattern: 'row',
        targets: 'one',
        targeting: 'facing',
        tiers: sameTiers({ damage: 1, shotsPerSecond: 1, range: 5, slowFactor: 0 }),
      }),
    };
    const board = withCells(
      boardFrom(`
        s t a f b
        t a s b f
        a s t f b
        s t a b f
        t M s f b
      `),
      [
        [
          { x: 1, y: 4 },
          { kind: 'building', building: 'mortar', tier: 'raw', facing: 'left' },
        ],
      ],
    );
    const result = simulateNight(state(board), two(2, 0), options({ buildings: rowBook }));
    const shot = kinds(result.events, 'shot')[0];
    expect(shot?.type === 'shot' ? shot.targets[0] : null).toBe('far');
  });
});

describe('правила оригинала: снаряды летят', () => {
  const withGargoyle = boardFrom(`
    s t a
    t a s
    a G t
    s t a
    t a s
  `);

  it('урон приходит позже выстрела — когда снаряд долетит', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h', kind: 'tank', column: 1, atSecond: 0 }),
      options({ projectileSpeed: 2 }),
    );
    const shot = kinds(result.events, 'shot')[0];
    const hit = kinds(result.events, 'hit')[0];
    expect(shot !== undefined && hit !== undefined && hit.at > shot.at).toBe(true);
  });

  it('без скорости снаряда — попадание сразу, как раньше', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'h', kind: 'tank', column: 1, atSecond: 0 }),
      options(),
    );
    expect(kinds(result.events, 'hit')[0]?.at).toBe(kinds(result.events, 'shot')[0]?.at);
  });

  it('болт лозы, чья цель погибла в полёте, бьёт следующего в столбце', () => {
    const vineBook: BuildingBook = {
      ...BUILDINGS,
      vine: spec({
        pattern: 'column',
        targets: 'one',
        targeting: 'vertical',
        tiers: sameTiers({ damage: 1, shotsPerSecond: 20, range: 1, slowFactor: 0 }),
      }),
    };
    const withVine = boardFrom(`
      V t a
      t a s
      a s t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(withVine),
      wave(
        { id: 'a', kind: 'weak', column: 0, atSecond: 0 },
        { id: 'b', kind: 'weak', column: 0, atSecond: 0.1 },
      ),
      options({ buildings: vineBook, projectileSpeed: 1 }),
    );
    // Много болтов вылетело в первого; когда он пал, остальные достались второму.
    expect(result.killed).toBe(2);
  });
});

describe('правила оригинала: отбрасывание и туман на половине клетки', () => {
  it('попадание отбрасывает врага от стрелка: до ворот он идёт дольше', () => {
    const withGargoyle = boardFrom(`
      s t a
      t G s
      a s t
      s t a
      t a s
    `);
    const walk = (knockback: number) =>
      simulateNight(
        state(withGargoyle),
        wave({ id: 'h', kind: 'pushed', column: 1, atSecond: 0 }),
        options({
          enemies: {
            ...ENEMIES,
            pushed: { hp: 1000, speed: 1, citadelDamage: 1, knockback, verified: true },
          },
        }),
      ).durationMs;
    expect(walk(0.05)).toBeGreaterThan(walk(0));
  });

  it('завеса с полосой замедляет меньше, чем завеса на всю клетку', () => {
    const withFog = boardFrom(`
      s t a
      t a s
      a W t
      s t a
      t a s
    `);
    const walk = (zone?: readonly [number, number]) =>
      simulateNight(
        state(withFog),
        wave({ id: 'h', kind: 'frozen', column: 1, atSecond: 0 }),
        options({
          enemies: { ...ENEMIES, frozen: { hp: 10, speed: 2, citadelDamage: 1, verified: true } },
          buildings: { ...BUILDINGS, fogveil: { ...BUILDINGS.fogveil, slowZone: zone } },
        }),
      ).durationMs;
    expect(walk([0.1, 0.6])).toBeLessThan(walk());
  });
});

describe('правила оригинала: паства выходит из проповедника', () => {
  it('паства появляется там, где он погиб, а не снизу поля', () => {
    const withGargoyle = boardFrom(`
      s t a
      t a s
      a G t
      s t a
      t a s
    `);
    const result = simulateNight(
      state(withGargoyle),
      wave(
        { id: 'boss', kind: 'weak', column: 1, atSecond: 0, boss: true },
        { id: 'flock', kind: 'tank', column: 1, atSecond: 0, afterDeathOf: 'boss' },
      ),
      options(),
    );
    const death = kinds(result.events, 'kill').find(
      (event) => event.type === 'kill' && event.id === 'boss',
    );
    const firstMove = kinds(result.events, 'move').find(
      (event) => event.type === 'move' && event.id === 'flock',
    );
    // Первый шаг паствы — из той клетки, где пал босс, а не из нижнего ряда.
    expect(death?.type === 'kill' && firstMove?.type === 'move' ? firstMove.from : null).toBe(
      death?.type === 'kill' ? Math.round(death.y) : -1,
    );
  });
});

describe('правила оригинала: пограничные случаи', () => {
  const fast = (targeting: 'gate' | 'nearest'): BuildingBook => ({
    ...BUILDINGS,
    gargoyle: spec({
      pattern: 'around',
      targets: 'one',
      targeting,
      tiers: sameTiers({ damage: 5, shotsPerSecond: 20, range: 1, slowFactor: 0 }),
    }),
  });
  const withGargoyle = boardFrom(`
    s t a
    t a s
    a G t
    s t a
    t a s
  `);

  it('явно развёрнутая вправо мортира у правого края бьёт вправо', () => {
    const rowBook: BuildingBook = {
      ...BUILDINGS,
      mortar: spec({
        pattern: 'row',
        targets: 'one',
        targeting: 'facing',
        tiers: sameTiers({ damage: 1, shotsPerSecond: 1, range: 5, slowFactor: 0 }),
      }),
    };
    const board = withCells(
      boardFrom(`
        s t a f b
        t a s b f
        a s t f b
        s t a b f
        t a s M b
      `),
      [
        [
          { x: 3, y: 4 },
          { kind: 'building', building: 'mortar', tier: 'raw', facing: 'right' },
        ],
      ],
    );
    const result = simulateNight(
      state(board),
      wave(
        { id: 'left', kind: 'tank', column: 2, atSecond: 0 },
        { id: 'right', kind: 'tank', column: 4, atSecond: 0 },
      ),
      options({ buildings: rowBook }),
    );
    const shot = kinds(result.events, 'shot')[0];
    expect(shot?.type === 'shot' ? shot.targets[0] : null).toBe('right');
  });

  it('nearest: в того, кого уже добивают летящие снаряды, второй не шлёт', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave(
        { id: 'doomed', kind: 'weak', column: 1, atSecond: 0 },
        { id: 'other', kind: 'tank', column: 0, atSecond: 0 },
      ),
      options({ buildings: fast('nearest'), projectileSpeed: 0.5 }),
    );
    const shots = kinds(result.events, 'shot').slice(0, 2);
    const targets = shots.map((shot) => (shot.type === 'shot' ? shot.targets[0] : null));
    expect(targets).toContain('other');
  });

  it('стрела, чья цель пала в полёте, пропадает', () => {
    const result = simulateNight(
      state(withGargoyle),
      wave({ id: 'weak', kind: 'weak', column: 1, atSecond: 0 }),
      options({ buildings: fast('gate'), projectileSpeed: 0.5 }),
    );
    // Выстрелов больше одного, а попадание одно — остальные ушли в никуда.
    expect(kinds(result.events, 'shot').length).toBeGreaterThan(1);
    expect(kinds(result.events, 'hit')).toHaveLength(1);
  });

  it('враг ровно в клетке стрелка не отбрасывается — отбрасывать некуда', () => {
    const bottom = boardFrom(`
      s t a
      t a s
      a s t
      s t a
      t G s
    `);
    const result = simulateNight(
      state(bottom),
      wave({ id: 'still', kind: 'rock', column: 1, atSecond: 0 }),
      options({
        maxSeconds: 1,
        enemies: {
          ...ENEMIES,
          rock: { hp: 1000, speed: 0, citadelDamage: 1, knockback: 1, verified: true },
        },
      }),
    );
    expect(result.survivors[0]?.y).toBe(4);
  });
});

describe('болт без новой цели', () => {
  it('цель ушла с поля, а в столбце больше никого — болты пропадают', () => {
    const vineBook: BuildingBook = {
      ...BUILDINGS,
      vine: spec({
        pattern: 'column',
        targets: 'one',
        targeting: 'vertical',
        tiers: sameTiers({ damage: 1, shotsPerSecond: 20, range: 1, slowFactor: 0 }),
      }),
    };
    const result = simulateNight(
      state(
        boardFrom(`
          V t a
          t a s
          a s t
          s t a
          t a s
        `),
      ),
      wave({ id: 'alone', kind: 'weak', column: 0, atSecond: 0 }),
      options({ buildings: vineBook, projectileSpeed: 0.5 }),
    );
    // Болты летят медленно: враг успевает дойти до ворот, и все они — в никуда.
    expect(kinds(result.events, 'shot').length).toBeGreaterThan(1);
    expect(kinds(result.events, 'hit')).toEqual([]);
    expect(result.leaked).toBe(1);
  });
});

describe('правила оригинала: враги подлетают снизу', () => {
  const withVine = boardFrom(`
    s t a
    t a s
    a V t
    s t a
    t a s
  `);
  const vineBook: BuildingBook = {
    ...BUILDINGS,
    vine: spec({
      pattern: 'column',
      targets: 'one',
      tiers: sameTiers({ damage: 1, shotsPerSecond: 5, range: 1, slowFactor: 0 }),
    }),
  };

  it('появляются на spawnDepth клеток ниже нижнего ряда', () => {
    const result = simulateNight(
      state(),
      wave({ id: 'h', kind: 'novice', column: 0, atSecond: 0 }),
      options({ spawnDepth: 4 }),
    );
    const spawn = kinds(result.events, 'spawn')[0];
    expect(spawn?.type === 'spawn' ? spawn.y : null).toBe(8);
  });

  it('лоза достаёт под поле на shootDepth рядов, но не глубже', () => {
    const shotsAt = (shootDepth: number) =>
      kinds(
        simulateNight(
          state(withVine),
          wave({ id: 'h', kind: 'tank', column: 1, atSecond: 0 }),
          options({ buildings: vineBook, spawnDepth: 4, shootDepth, maxSeconds: 1 }),
        ).events,
        'shot',
      ).length;
    // За первую секунду враг ещё под полем: стреляют, только если туда достают.
    expect(shotsAt(0)).toBe(0);
    expect(shotsAt(3)).toBeGreaterThan(0);
  });

  it('под полем туман не замедляет', () => {
    const withFog = boardFrom(`
      s t a
      t a s
      a s t
      s t a
      t W s
    `);
    const walk = (board: typeof withFog) =>
      simulateNight(
        state(board),
        wave({ id: 'h', kind: 'novice', column: 1, atSecond: 0 }),
        options({ spawnDepth: 4, maxSeconds: 1 }),
      ).survivors[0]?.y;
    // Первая секунда — под полем: с завесой в нижнем ряду и без неё одинаково.
    expect(walk(withFog)).toBe(walk(EMPTY_FIELD));
  });
});

describe('разлёт паствы — как в оригинале', () => {
  it('на 5…(20 + 0,6 × ночь) точек клетки 48 — не дальше и не ближе', () => {
    for (let index = 0; index < 40; index++) {
      const { dx, dy } = flockBurst(index, 10);
      const distance = Math.hypot(dx, dy) * 48;
      expect(distance).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(distance).toBeLessThanOrEqual(26 + 1e-9);
    }
  });

  it('соседи по номеру разлетаются в разные стороны, а не в одну точку', () => {
    const points = Array.from({ length: 10 }, (_, index) => flockBurst(index, 10));
    const spots = new Set(points.map(({ dx, dy }) => `${dx.toFixed(2)}:${dy.toFixed(2)}`));
    expect(spots.size).toBe(10);
    expect(points.some(({ dy }) => dy < 0)).toBe(true);
    expect(points.some(({ dy }) => dy > 0)).toBe(true);
  });

  it('одна ночь — один и тот же разлёт: бой повторяется', () => {
    expect(flockBurst(3, 20)).toEqual(flockBurst(3, 20));
  });
});

describe('разлёт паствы в бою', () => {
  it('поздней ночью вылетевший дальше полуклетки уходит в соседний столбец — но не за поле', () => {
    const withGargoyle = boardFrom(`
      G t a
      t a s
      a t s
      s t a
      t a s
    `);
    const flock = Array.from({ length: 40 }, (_, index) => ({
      id: `flock-${String(index)}`,
      kind: 'weak',
      column: 0,
      atSecond: 0,
      afterDeathOf: 'boss',
    }));
    const result = simulateNight(
      { ...state(withGargoyle), night: 50 },
      wave({ id: 'boss', kind: 'weak', column: 0, atSecond: 0, boss: true }, ...flock),
      options(),
    );
    const columns = new Set(
      result.events.flatMap((event) =>
        event.type === 'spawn' && event.id.startsWith('flock') ? [event.column] : [],
      ),
    );
    expect([...columns].sort()).toEqual([0, 1]);
  });
});

describe('босс у ворот — бьёт и за свою паству', () => {
  it('дошёл со свитой внутри: урон — его и каждого прихожанина, свита на поле не выходит', () => {
    const result = simulateNight(
      state(EMPTY_FIELD, 30),
      wave(
        { id: 'boss', kind: 'novice', column: 1, atSecond: 0, boss: true },
        { id: 'f1', kind: 'novice', column: 1, atSecond: 0, afterDeathOf: 'boss' },
        { id: 'f2', kind: 'novice', column: 1, atSecond: 0, afterDeathOf: 'boss' },
        { id: 'f3', kind: 'tank', column: 1, atSecond: 0, afterDeathOf: 'boss' },
      ),
      options(),
    );
    const leak = kinds(result.events, 'leak')[0];
    // Сам босс — 4, двое по 4 и один по 1: 13 сердец одним ударом.
    expect(leak?.type === 'leak' ? leak.damage : null).toBe(13);
    expect(result.citadel.hearts).toBe(17);
    expect(result.leaked).toBe(4);
    expect(
      kinds(result.events, 'spawn').map((event) => (event.type === 'spawn' ? event.id : '')),
    ).toEqual(['boss']);
  });

  it('обычный враг у ворот бьёт только за себя', () => {
    const result = simulateNight(
      state(EMPTY_FIELD, 30),
      wave({ id: 'h1', kind: 'novice', column: 0, atSecond: 0 }),
      options(),
    );
    expect(result.citadel.hearts).toBe(26);
  });
});
