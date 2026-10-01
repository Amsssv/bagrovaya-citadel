import { describe, expect, it } from 'vitest';

import { BOSS_CONFIG } from '@/shared/config/bosses';
import { createRng } from '@/shared/lib/rng';

import { bossColumn, bossSpawns, isBossNight, nextBossNight, preacherIndexFor } from './boss';
import type { BossPlan, PreacherPlan } from './boss';

const FIRST: PreacherPlan = {
  kind: 'preacher-1',
  flockKind: 'zealot',
  flockSize: 3,
  flockDelaySeconds: 1,
  flockSpread: 1,
};

const PLAN: BossPlan = {
  nights: [10, 20, 30, 40, 50],
  preachers: [
    FIRST,
    { kind: 'preacher-2', flockKind: 'zealot', flockSize: 6, flockDelaySeconds: 1, flockSpread: 1 },
    {
      kind: 'preacher-3',
      flockKind: 'zealot',
      flockSize: 12,
      flockDelaySeconds: 1,
      flockSpread: 2,
    },
    {
      kind: 'preacher-4',
      flockKind: 'zealot',
      flockSize: 30,
      flockDelaySeconds: 1,
      flockSpread: 2,
    },
  ],
};

const rng = () => createRng(1).fork('wave');

describe('проповедник приходит на 10, 20, 30, 40 и 50 ночь (§10)', () => {
  it('узнаёт ночи прихода', () => {
    for (const night of [10, 20, 30, 40, 50]) {
      expect(isBossNight(PLAN, night), `ночь ${String(night)}`).toBe(true);
    }
  });

  it('в остальные ночи его нет', () => {
    for (const night of [1, 9, 11, 25, 49, 51, 60]) {
      expect(isBossNight(PLAN, night), `ночь ${String(night)}`).toBe(false);
    }
  });
});

describe('проповедников четверо, а приходов пять', () => {
  it('первые четыре прихода — по своему проповеднику', () => {
    expect(preacherIndexFor(PLAN, 10)).toBe(0);
    expect(preacherIndexFor(PLAN, 20)).toBe(1);
    expect(preacherIndexFor(PLAN, 30)).toBe(2);
    expect(preacherIndexFor(PLAN, 40)).toBe(3);
  });

  it('на пятидесятую приходит четвёртый — временное правило, пока не проверено', () => {
    expect(preacherIndexFor(PLAN, 50)).toBe(3);
  });

  it('в обычную ночь проповедника нет вовсе', () => {
    expect(preacherIndexFor(PLAN, 7)).toBeNull();
  });
});

describe('состав ночи проповедника', () => {
  it('в обычную ночь ничего не добавляет', () => {
    expect(bossSpawns(PLAN, 7, 6, rng())).toEqual([]);
  });

  it('проповедник выходит первым и сразу', () => {
    const spawns = bossSpawns(PLAN, 10, 6, rng());
    expect(spawns[0]?.kind).toBe('preacher-1');
    expect(spawns[0]?.atSecond).toBe(0);
    expect(spawns[0]?.afterDeathOf).toBeUndefined();
  });

  it('паствы столько, сколько положено этому проповеднику', () => {
    expect(bossSpawns(PLAN, 10, 6, rng())).toHaveLength(1 + 3);
    expect(bossSpawns(PLAN, 30, 6, rng())).toHaveLength(1 + 12);
  });

  it('к пятому приходу выходит больше тридцати', () => {
    expect(bossSpawns(PLAN, 50, 6, rng()).length).toBeGreaterThan(30);
  });

  it('вся паства ждёт его смерти', () => {
    const spawns = bossSpawns(PLAN, 10, 6, rng());
    const boss = spawns[0];
    for (const spawn of spawns.slice(1)) {
      expect(spawn.afterDeathOf).toBe(boss?.id);
      expect(spawn.atSecond).toBe(1);
    }
  });

  it('идентификаторы не повторяются', () => {
    const spawns = bossSpawns(PLAN, 50, 6, rng());
    expect(new Set(spawns.map((spawn) => spawn.id)).size).toBe(spawns.length);
  });

  it('без паствы выходит один проповедник', () => {
    const lonely: BossPlan = {
      ...PLAN,
      preachers: [{ ...FIRST, flockSize: 0 }],
    };
    expect(bossSpawns(lonely, 10, 6, rng())).toHaveLength(1);
  });
});

describe('паства расходится по соседним столбцам (§10)', () => {
  it('занимает и его столбец, и соседние', () => {
    const spawns = bossSpawns(PLAN, 10, 6, rng());
    const bossColumn = spawns[0]?.column ?? -1;
    const flockColumns = new Set(spawns.slice(1).map((spawn) => spawn.column));

    expect(flockColumns.has(bossColumn)).toBe(true);
    expect(flockColumns.size).toBeGreaterThan(1);
  });

  it('за край поля не выходит', () => {
    // Узкое поле: разброс неизбежно упирается в края.
    const spawns = bossSpawns(PLAN, 30, 2, rng());
    for (const spawn of spawns) {
      expect(spawn.column).toBeGreaterThanOrEqual(0);
      expect(spawn.column).toBeLessThan(2);
    }
  });

  it('на поле в один столбец все идут по нему', () => {
    const spawns = bossSpawns(PLAN, 10, 1, rng());
    expect(spawns.every((spawn) => spawn.column === 0)).toBe(true);
  });
});

describe('столбец прихода известен заранее (§10)', () => {
  it('на одном сиде — один и тот же столбец', () => {
    expect(bossSpawns(PLAN, 10, 6, rng())[0]?.column).toBe(
      bossSpawns(PLAN, 10, 6, rng())[0]?.column,
    );
  });

  it('на разных сидах столбцы расходятся', () => {
    const columns = new Set(
      Array.from(
        { length: 20 },
        (_, seed) => bossSpawns(PLAN, 10, 6, createRng(seed).fork('wave'))[0]?.column,
      ),
    );
    expect(columns.size).toBeGreaterThan(1);
  });
});

describe('столбец босса показывают ещё в Сумерках', () => {
  it('считается от сида и ночи: спросить заранее — то же, что в бою', () => {
    expect(bossColumn(42, 10, 6)).toBe(bossColumn(42, 10, 6));
    const column = bossColumn(42, 10, 6);
    expect(bossSpawns(PLAN, 10, 6, rng(), column)[0]?.column).toBe(column);
  });

  it('паства расходится от показанного столбца', () => {
    const spawns = bossSpawns(PLAN, 10, 6, rng(), 0);
    expect(spawns.every((spawn) => spawn.column <= 1)).toBe(true);
  });

  it('всегда в пределах поля, и не всегда один и тот же', () => {
    const columns = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      for (const night of [10, 20, 30]) {
        const column = bossColumn(seed, night, 6);
        expect(column).toBeGreaterThanOrEqual(0);
        expect(column).toBeLessThan(6);
        columns.add(column);
      }
    }
    expect(columns.size).toBe(6);
  });
});

describe('боевой конфиг проповедников', () => {
  it('ночи прихода подтверждены спекой', () => {
    expect(BOSS_CONFIG.nights).toEqual([10, 20, 30, 40, 50]);
  });

  it('на каждый приход — своя запись: паства растёт, как в оригинале', () => {
    expect(BOSS_CONFIG.preachers).toHaveLength(BOSS_CONFIG.nights.length);
    expect(BOSS_CONFIG.preachers.map((preacher) => preacher.flockSize)).toEqual([
      10, 17, 24, 31, 38,
    ]);
  });

  it('размер паствы выдуман (§14 #13) и помечен', () => {
    expect(BOSS_CONFIG.verified).toBe(false);
  });

  it('паства растёт от проповедника к проповеднику: каждый следующий сильнее', () => {
    const sizes = BOSS_CONFIG.preachers.map((preacher) => preacher.flockSize);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(sizes.at(-1)).toBeGreaterThan(30); // «к пятому больше тридцати»
  });

  it('на боевом конфиге ночь проповедника приносит его и паству', () => {
    const spawns = bossSpawns(BOSS_CONFIG, 10, 6, rng());
    expect(spawns).toHaveLength(1 + (BOSS_CONFIG.preachers[0]?.flockSize ?? 0));
  });
});

describe('ближайшая ночь босса — для отсчёта в шапке', () => {
  it('эта ночь, если она босса, иначе следующая', () => {
    expect(nextBossNight(PLAN, 1)).toBe(10);
    expect(nextBossNight(PLAN, 10)).toBe(10);
    expect(nextBossNight({ ...PLAN, nights: [20, 10] }, 11)).toBe(20);
  });

  it('боссы кончились — null', () => {
    expect(nextBossNight(PLAN, 51)).toBeNull();
    expect(nextBossNight(PLAN, 11)).toBe(20);
  });
});
