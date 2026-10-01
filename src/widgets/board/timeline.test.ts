import { describe, expect, it } from 'vitest';

import type { MoveStage } from '@/entities/board';
import { boardFrom } from '@/entities/board/__testing__/boardFrom';

import {
  DEAL,
  DURATION,
  dealDelay,
  dealDuration,
  fallDuration,
  gatherTargets,
  mergeFocus,
  stageDuration,
  totalDuration,
} from './timeline';

const board = boardFrom('s t a');

const stage = (parts: Partial<MoveStage> & { kind: MoveStage['kind'] }): MoveStage => ({
  board,
  removed: [],
  appeared: [],
  moved: [],
  groups: [],
  fallen: new Map(),
  ...parts,
});

describe('длительность падения', () => {
  it('падение на две клетки дольше, чем на одну', () => {
    expect(fallDuration(2)).toBeGreaterThan(fallDuration(1));
  });

  it('растёт медленнее, чем расстояние: падать шесть клеток вшестеро дольше скучно', () => {
    expect(fallDuration(6)).toBeLessThan(fallDuration(1) * 6);
  });

  it('есть нижняя граница — иначе короткое падение мигнёт незаметно', () => {
    expect(fallDuration(0)).toBe(DURATION.fallMin);
  });
});

describe('длительность шага', () => {
  it('свап — время обмена', () => {
    expect(
      stageDuration(
        stage({
          kind: 'action',
          moved: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
          ],
        }),
      ),
    ).toBe(DURATION.swap);
  });

  it('действие без обмена — время исчезновения', () => {
    expect(stageDuration(stage({ kind: 'action', removed: [{ x: 0, y: 0 }] }))).toBe(
      DURATION.vanish,
    );
  });

  it('сбор и слияние — исчезновение плюс появление', () => {
    const expected = DURATION.vanish + DURATION.pop;
    expect(stageDuration(stage({ kind: 'reap' }))).toBe(expected);
    expect(stageDuration(stage({ kind: 'merge' }))).toBe(expected);
  });

  it('оседание идёт столько, сколько летит самая дальняя клетка', () => {
    const fallen = new Map([
      [0, 1],
      [1, 4],
    ]);
    expect(stageDuration(stage({ kind: 'settle', fallen }))).toBe(fallDuration(4));
  });

  it('оседание без падений всё равно занимает нижнюю границу', () => {
    expect(stageDuration(stage({ kind: 'settle' }))).toBe(0);
  });
});

describe('общая длительность', () => {
  const stages = [
    stage({
      kind: 'action',
      moved: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }),
    stage({ kind: 'reap' }),
    stage({ kind: 'settle', fallen: new Map([[0, 2]]) }),
  ];

  it('складывается из шагов', () => {
    expect(totalDuration(stages, 1)).toBe(
      DURATION.swap + DURATION.vanish + DURATION.pop + fallDuration(2),
    );
  });

  it('на двойной скорости вдвое короче', () => {
    expect(totalDuration(stages, 2)).toBe(totalDuration(stages, 1) / 2);
  });

  it('без шагов — нисколько', () => {
    expect(totalDuration([], 1)).toBe(0);
  });
});

describe('куда сходятся постройки при слиянии', () => {
  const board = { width: 1, height: 1, cells: [] };
  const fallen = new Map<number, number>();

  it('к клетке, где встала новая: три сливаются в одну (§6)', () => {
    expect(
      mergeFocus({
        kind: 'merge',
        board,
        fallen,
        moved: [],
        groups: [],
        removed: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        appeared: [{ x: 1, y: 0 }],
      }),
    ).toEqual({ x: 1, y: 0 });
  });

  it('не слияние — сходиться не к чему', () => {
    expect(
      mergeFocus({
        kind: 'reap',
        board,
        fallen,
        moved: [],
        groups: [],
        removed: [],
        appeared: [{ x: 1, y: 0 }],
      }),
    ).toBeNull();
  });

  it('ничего не появилось — сходиться не к чему', () => {
    expect(
      mergeFocus({
        kind: 'merge',
        board,
        fallen,
        moved: [],
        groups: [],
        removed: [],
        appeared: [],
      }),
    ).toBeNull();
  });

  it('появилось несколько — не угадываем, к какой', () => {
    expect(
      mergeFocus({
        kind: 'merge',
        board,
        fallen,
        moved: [],
        groups: [],
        removed: [],
        appeared: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      }),
    ).toBeNull();
  });
});

describe('куда стягиваются клетки группы', () => {
  const board = { width: 6, height: 6, cells: [] };
  const fallen = new Map<number, number>();
  const at = (x: number, y: number) => ({ x, y });

  it('тройка — в клетку, где встала постройка', () => {
    const targets = gatherTargets({
      kind: 'reap',
      board,
      fallen,
      moved: [],
      removed: [at(0, 0), at(1, 0), at(2, 0)],
      appeared: [at(1, 0)],
      groups: [[at(0, 0), at(1, 0), at(2, 0)]],
    });
    expect(targets.get('0,0')).toEqual(at(1, 0));
    expect(targets.get('2,0')).toEqual(at(1, 0));
    expect(targets.get('1,0')).toEqual(at(1, 0));
  });

  it('группа, у которой ничего не появилось, гаснет на месте', () => {
    const targets = gatherTargets({
      kind: 'reap',
      board,
      fallen,
      moved: [],
      removed: [at(0, 0), at(1, 0), at(2, 0)],
      appeared: [],
      groups: [[at(0, 0), at(1, 0), at(2, 0)]],
    });
    expect(targets.size).toBe(0);
  });

  it('две группы разом — каждая в свою клетку', () => {
    const targets = gatherTargets({
      kind: 'reap',
      board,
      fallen,
      moved: [],
      removed: [at(0, 0), at(1, 0), at(2, 0), at(0, 3), at(0, 4), at(0, 5)],
      appeared: [at(2, 0), at(0, 4)],
      groups: [
        [at(0, 0), at(1, 0), at(2, 0)],
        [at(0, 3), at(0, 4), at(0, 5)],
      ],
    });
    expect(targets.get('0,0')).toEqual(at(2, 0));
    expect(targets.get('0,5')).toEqual(at(0, 4));
  });

  it('слияние построек — так же', () => {
    const targets = gatherTargets({
      kind: 'merge',
      board,
      fallen,
      moved: [],
      removed: [at(3, 3), at(3, 4), at(3, 5)],
      appeared: [at(3, 5)],
      groups: [[at(3, 3), at(3, 4), at(3, 5)]],
    });
    expect(targets.get('3,3')).toEqual(at(3, 5));
  });

  it('у свапа и оседания стягивать нечего', () => {
    expect(
      gatherTargets({
        kind: 'settle',
        board,
        fallen,
        moved: [],
        removed: [],
        appeared: [],
        groups: [],
      }).size,
    ).toBe(0);
  });
});

describe('раздача нового поля', () => {
  it('нижний ряд падает первым, верхний — последним', () => {
    expect(dealDelay({ x: 0, y: 5 }, 6)).toBe(0);
    expect(dealDelay({ x: 0, y: 0 }, 6)).toBeGreaterThan(dealDelay({ x: 0, y: 3 }, 6));
  });

  it('в ряду столбцы чуть сдвинуты, но ряд не догоняет следующий', () => {
    const lastInRow = dealDelay({ x: 5, y: 5 }, 6);
    expect(lastInRow).toBeGreaterThan(dealDelay({ x: 0, y: 5 }, 6));
    expect(lastInRow).toBeLessThan(dealDelay({ x: 0, y: 4 }, 6) + DEAL.rowMs);
  });

  it('вся раздача укладывается в пару секунд', () => {
    const total = dealDuration(6, 6);
    expect(total).toBeGreaterThan(fallDuration(6));
    expect(total).toBeLessThan(2000);
  });
});
