import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from '@/entities/board/__testing__/boardFrom';
import { cellAt } from '@/entities/board';
import { countOf, createInventory } from '@/entities/item';
import { createPurse } from '@/entities/player';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import { createRng } from '@/shared/lib/rng';

import { canPlay, comboBonus, costOf, isTwilightOver, mortarFacing, playMove } from './twilight';
import type { PlayerMove, TwilightOptions, TwilightState } from './twilight';

const COSTS = ECONOMY_CONFIG.costs;

function options(seed = 1): TwilightOptions {
  return {
    rng: createRng(seed).fork('refill'),
    resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
    costs: COSTS,
    longMatchFrom: 4,
    potionSwaps: {
      raw: 3,
      bone: ECONOMY_CONFIG.potions.bone.swaps,
      obsidian: ECONOMY_CONFIG.potions.obsidian.swaps,
      crimson: ECONOMY_CONFIG.potions.crimson.swaps,
    },
  };
}

const board = boardFrom(`
  s t a f b
  t P f b s
  a f b s t
  f b s t a
`);

const state = (swaps: number): TwilightState => ({
  board,
  purse: createPurse(swaps),
  inventory: createInventory(),
});

describe('цена хода', () => {
  it('свап и сброс за край стоят по единице', () => {
    expect(costOf({ type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, COSTS)).toBe(1);
    expect(costOf({ type: 'drop', from: { x: 0, y: 0 }, direction: 'left' }, COSTS)).toBe(1);
  });

  it('выпить потир бесплатно: это тап, а не свап', () => {
    expect(costOf({ type: 'open', at: { x: 1, y: 1 } }, COSTS)).toBe(0);
  });
});

describe('ход тратит свап', () => {
  const swapMove: PlayerMove = { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } };

  it('свап списывается с кошелька', () => {
    const step = playMove(state(10), swapMove, options());
    expect(step.state.purse.swaps).toBe(9);
    expect(step.cost).toBe(1);
  });

  it('поле после хода меняется', () => {
    const step = playMove(state(10), swapMove, options());
    expect(pictureOf(step.state.board)).not.toBe(pictureOf(board));
  });

  it('сброс за край тоже платный (§3)', () => {
    const step = playMove(
      state(10),
      { type: 'drop', from: { x: 0, y: 0 }, direction: 'left' },
      options(),
    );
    expect(step.state.purse.swaps).toBe(9);
  });

  it('исходное состояние не меняется', () => {
    const before = state(10);
    playMove(before, swapMove, options());
    expect(before.purse.swaps).toBe(10);
    expect(pictureOf(before.board)).toBe(pictureOf(board));
  });
});

describe('вскрытие потира возвращает свапы (§8)', () => {
  const open: PlayerMove = { type: 'open', at: { x: 1, y: 1 } };

  it('ничего не платим, получаем по ступени', () => {
    const step = playMove(state(10), open, options());
    expect(step.cost).toBe(0);
    expect(step.granted).toBe(3);
    expect(step.state.purse.swaps).toBe(13);
  });

  it('выпитый потир уходит с поля', () => {
    const step = playMove(state(10), open, options());
    expect(step.move.stages[0]?.removed).toEqual([{ x: 1, y: 1 }]);
  });

  it('Костяной потир даёт двенадцать', () => {
    const boneBoard = boardFrom(`
      s t a f b
      t P f b s
      a f b s t
      f b s t a
    `);
    const withBone: TwilightState = {
      board: boneBoard,
      purse: createPurse(5),
      inventory: createInventory(),
    };
    const step = playMove(withBone, open, {
      ...options(),
      potionSwaps: { ...options().potionSwaps, raw: 12 },
    });
    expect(step.granted).toBe(12);
    expect(step.state.purse.swaps).toBe(17);
  });

  it('выпить можно и на последней капле', () => {
    const step = playMove(state(1), open, options());
    expect(step.state.purse.swaps).toBe(4);
  });
});

describe('длинный матч наливает крови', () => {
  // Свап (0,0)↔(1,0) ставит камень в ряд из четырёх: s s s s.
  const four = boardFrom(`
    t s s s a
    s a f b t
    a f b t f
    f b t f a
  `);
  const swapIn: PlayerMove = { type: 'swap', from: { x: 0, y: 0 }, to: { x: 0, y: 1 } };

  it('четвёрка за свап возвращает каплю', () => {
    const step = playMove(
      { board: four, purse: createPurse(5), inventory: createInventory() },
      swapIn,
      options(),
    );
    expect(step.move.matches.some((match) => match.cells.length >= 4)).toBe(true);
    expect(step.granted).toBeGreaterThanOrEqual(1);
    expect(step.state.purse.swaps).toBe(5 - 1 + step.granted);
  });

  it('шаг сбора знает свои группы — по ним поле пускает капли к шкале', () => {
    const step = playMove(
      { board: four, purse: createPurse(5), inventory: createInventory() },
      swapIn,
      options(),
    );
    const reap = step.move.stages.find((stage) => stage.kind === 'reap');
    expect(reap?.groups.some((group) => group.length >= 4)).toBe(true);
    const cells = reap?.groups.flat().length;
    expect(cells).toBe(reap?.removed.length);
  });

  it('тройка крови не возвращает', () => {
    const three = boardFrom(`
      t s s a f
      s a f b t
      a f b t f
      f b t f a
    `);
    const step = playMove(
      { board: three, purse: createPurse(5), inventory: createInventory() },
      swapIn,
      { ...options(), cascadesEnabled: false },
    );
    expect(step.move.matches.length).toBeGreaterThan(0);
    expect(step.granted).toBe(0);
  });
});

describe('когда свапов не хватает', () => {
  const swapMove: PlayerMove = { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } };

  it('canPlay отказывает при пустом кошельке', () => {
    expect(canPlay(state(0), swapMove, options())).toBe(false);
    expect(canPlay(state(1), swapMove, options())).toBe(true);
  });

  it('playMove бросает, а не уводит кошелёк в минус', () => {
    expect(() => playMove(state(0), swapMove, options())).toThrow();
  });

  it('кончились свапы — Сумерки окончены (§2)', () => {
    expect(isTwilightOver(state(0))).toBe(true);
    expect(isTwilightOver(state(1))).toBe(false);
  });

  it('canPlay отказывает и на невозможном ходе, не только на бедности', () => {
    expect(canPlay(state(10), { type: 'open', at: { x: 0, y: 0 } }, options())).toBe(false);
    expect(
      canPlay(state(10), { type: 'drop', from: { x: 1, y: 0 }, direction: 'left' }, options()),
    ).toBe(false);
    expect(
      canPlay(state(10), { type: 'swap', from: { x: 0, y: 0 }, to: { x: 2, y: 2 } }, options()),
    ).toBe(false);
  });
});

describe('экономика замкнута', () => {
  it('после любой цепочки ходов запас равен «начало + выдано − потрачено»', () => {
    const script: PlayerMove[] = [
      { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { type: 'drop', from: { x: 0, y: 3 }, direction: 'down' },
      { type: 'open', at: { x: 1, y: 1 } },
      { type: 'swap', from: { x: 3, y: 2 }, to: { x: 3, y: 3 } },
      { type: 'swap', from: { x: 2, y: 0 }, to: { x: 2, y: 1 } },
    ];

    let current = state(20);
    let granted = 0;
    let spent = 0;

    for (const move of script) {
      if (!canPlay(current, move, options())) continue;
      const step = playMove(current, move, options());
      granted += step.granted;
      spent += step.cost;
      current = step.state;

      expect(current.purse.swaps).toBe(
        current.purse.initial + current.purse.granted - current.purse.spent,
      );
    }

    expect(current.purse.granted).toBe(granted);
    expect(current.purse.spent).toBe(spent);
    expect(current.purse.swaps).toBe(20 + granted - spent);
  });

  it('без потиров запас только убывает — забег конечен', () => {
    const noPotions = boardFrom(`
      s t a f
      t a f s
      a f s t
    `);
    let current: TwilightState = {
      board: noPotions,
      purse: createPurse(4),
      inventory: createInventory(),
    };

    for (let i = 0; i < 4; i++) {
      current = playMove(
        current,
        { type: 'swap', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        options(),
      ).state;
    }

    expect(current.purse.swaps).toBe(0);
    expect(isTwilightOver(current)).toBe(true);
  });
});

describe('ходы предметами (§11)', () => {
  const withItems = (items: Record<string, number>): TwilightState => ({
    board: boardFrom(`
      s t a f b
      t G f b s
      a f b s t
      f b s t a
    `),
    purse: createPurse(10),
    inventory: createInventory(items),
  });

  const ash: PlayerMove = { type: 'item', item: 'cursed-ash', cells: [{ x: 0, y: 0 }] };

  it('предмет списывается из инвентаря', () => {
    const step = playMove(withItems({ 'cursed-ash': 2 }), ash, options());
    expect(countOf(step.state.inventory, 'cursed-ash')).toBe(1);
  });

  it('последний предмет уходит из инвентаря целиком', () => {
    const step = playMove(withItems({ 'cursed-ash': 1 }), ash, options());
    expect(countOf(step.state.inventory, 'cursed-ash')).toBe(0);
  });

  it('свапов ход предметом не стоит — так решено конфигом', () => {
    const step = playMove(withItems({ 'cursed-ash': 1 }), ash, options());
    expect(step.cost).toBe(0);
    expect(step.state.purse.swaps).toBe(10);
  });

  it('прах подрывает клетку, поле досыпается', () => {
    const step = playMove(withItems({ 'cursed-ash': 1 }), ash, options());
    expect(step.state.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
    expect(step.move.stages[0]?.removed).toEqual([{ x: 0, y: 0 }]);
  });

  it('нетопыри меняют местами две далёкие клетки', () => {
    const state = withItems({ bats: 1 });
    const step = playMove(
      state,
      {
        type: 'item',
        item: 'bats',
        cells: [
          { x: 0, y: 0 },
          { x: 4, y: 3 },
        ],
      },
      options(),
    );
    expect(cellAt(step.state.board, { x: 0, y: 0 })).toEqual(cellAt(state.board, { x: 4, y: 3 }));
  });

  it('столб тумана встаёт на поле', () => {
    const step = playMove(
      withItems({ 'fog-pillar': 1 }),
      { type: 'item', item: 'fog-pillar', cells: [{ x: 0, y: 0 }] },
      options(),
    );
    expect(cellAt(step.state.board, { x: 0, y: 0 })).toMatchObject({
      kind: 'building',
      building: 'fogveil',
    });
  });

  it('печать поднимает постройку на ступень', () => {
    const step = playMove(
      withItems({ 'seal-bone': 1 }),
      { type: 'item', item: 'seal-bone', cells: [{ x: 1, y: 1 }] },
      options(),
    );
    expect(cellAt(step.state.board, { x: 1, y: 1 })).toMatchObject({ tier: 'bone' });
  });
});

describe('когда предметом не сходить', () => {
  const empty = (): TwilightState => ({
    board: boardFrom(`
      s t a f b
      t G f b s
      a f b s t
      f b s t a
    `),
    purse: createPurse(10),
    inventory: createInventory({ 'cursed-ash': 1, hourglass: 1, 'seal-crimson': 1 }),
  });

  it('которого нет в инвентаре', () => {
    expect(
      canPlay(
        empty(),
        {
          type: 'item',
          item: 'bats',
          cells: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        options(),
      ),
    ).toBe(false);
  });

  it('которому некуда лечь', () => {
    expect(
      canPlay(empty(), { type: 'item', item: 'seal-crimson', cells: [{ x: 1, y: 1 }] }, options()),
    ).toBe(false);
  });

  it('которому не хватило клеток', () => {
    expect(canPlay(empty(), { type: 'item', item: 'cursed-ash', cells: [] }, options())).toBe(
      false,
    );
  });

  it('чьё применение спека не описывает', () => {
    expect(canPlay(empty(), { type: 'item', item: 'hourglass', cells: [] }, options())).toBe(false);
  });

  it('а вот эти ходы предметами возможны', () => {
    const state: TwilightState = {
      ...empty(),
      inventory: createInventory({ 'cursed-ash': 1, 'fog-pillar': 1, bats: 1, 'seal-bone': 1 }),
    };
    expect(
      canPlay(state, { type: 'item', item: 'cursed-ash', cells: [{ x: 0, y: 0 }] }, options()),
    ).toBe(true);
    expect(
      canPlay(state, { type: 'item', item: 'fog-pillar', cells: [{ x: 0, y: 0 }] }, options()),
    ).toBe(true);
    expect(
      canPlay(state, { type: 'item', item: 'seal-bone', cells: [{ x: 1, y: 1 }] }, options()),
    ).toBe(true);
    expect(
      canPlay(
        state,
        {
          type: 'item',
          item: 'bats',
          cells: [
            { x: 0, y: 0 },
            { x: 4, y: 3 },
          ],
        },
        options(),
      ),
    ).toBe(true);
  });

  it('нетопырям одной клетки мало', () => {
    const state: TwilightState = { ...empty(), inventory: createInventory({ bats: 1 }) };
    expect(canPlay(state, { type: 'item', item: 'bats', cells: [{ x: 0, y: 0 }] }, options())).toBe(
      false,
    );
  });

  it('playMove на невозможном ходе бросает', () => {
    expect(() =>
      playMove(
        empty(),
        {
          type: 'item',
          item: 'bats',
          cells: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
        },
        options(),
      ),
    ).toThrow();
  });
});

describe('ход в башню без башен', () => {
  it('playMove без гнёзд — ошибка: canPlay такой ход не пропускает', () => {
    const move: PlayerMove = { type: 'nest', from: { x: 0, y: 0 }, direction: 'up' };
    const bare: TwilightState = {
      board: boardFrom(`
        G t a
        s t a
      `),
      purse: createPurse(5),
      inventory: createInventory(),
    };
    expect(canPlay(bare, move, options())).toBe(false);
    expect(() => playMove(bare, move, options())).toThrow();
  });
});

describe('кровь как в оригинале: длинные слияния и комбо', () => {
  const RULES = {
    ...options(),
    longMerge: { building: 3, potion: { raw: 4, bone: 16, obsidian: 90, crimson: 420 } },
    comboFrom: 3,
  };
  const swapRight = (x: number, y: number): PlayerMove => ({
    type: 'swap',
    from: { x, y },
    to: { x: x + 1, y },
  });

  it('четыре Грубые горгульи в ряд — слияние и 3 капли сверху', () => {
    // Горгулья справа встаёт в ряд к трём: линия из четырёх.
    const four: TwilightState = {
      board: boardFrom(`
        G G G s G
        t a f b s
        a f b s t
      `),
      purse: createPurse(10),
      inventory: createInventory(),
    };
    const step = playMove(four, swapRight(3, 0), RULES);
    expect(step.move.merges[0]?.cells).toHaveLength(4);
    expect(step.mergeBonus).toBe(3);
  });

  it('четыре Грубых потира — 4 капли сверху', () => {
    const four: TwilightState = {
      board: boardFrom(`
        P P P s P
        t a f b s
        a f b s t
      `),
      purse: createPurse(10),
      inventory: createInventory(),
    };
    expect(playMove(four, swapRight(3, 0), RULES).mergeBonus).toBe(4);
  });

  it('без правил длинного слияния — без бонуса', () => {
    const four: TwilightState = {
      board: boardFrom(`
        G G G s G
        t a f b s
        a f b s t
      `),
      purse: createPurse(10),
      inventory: createInventory(),
    };
    expect(playMove(four, swapRight(3, 0), options()).mergeBonus).toBe(0);
  });

  it('комбо: три группы за ход — капля, каждая следующая — ещё капля', () => {
    expect(comboBonus(2, 3)).toBe(0);
    expect(comboBonus(3, 3)).toBe(1);
    expect(comboBonus(5, 3)).toBe(3);
    expect(comboBonus(9, undefined)).toBe(0);
  });

  it('всё налитое идёт в кошелёк и в granted', () => {
    const four: TwilightState = {
      board: boardFrom(`
        G G G s G
        t a f b s
        a f b s t
      `),
      purse: createPurse(10),
      inventory: createInventory(),
    };
    const step = playMove(four, swapRight(3, 0), RULES);
    expect(step.granted).toBe(step.bonus + step.mergeBonus + step.comboBonus);
    expect(step.state.purse.swaps).toBe(10 - step.cost + step.granted);
  });
});

describe('разворот мортиры тапом — как пушки в оригинале', () => {
  const withMortar: TwilightState = {
    board: boardFrom(`
      s t a f b s
      t a M s b f
    `),
    purse: createPurse(5),
    inventory: createInventory(),
  };
  const flip: PlayerMove = { type: 'flip', at: { x: 2, y: 1 } };

  it('по умолчанию смотрит вправо, у правого края — влево', () => {
    expect(mortarFacing(withMortar.board, { x: 2, y: 1 })).toBe('right');
    expect(mortarFacing(withMortar.board, { x: 4, y: 1 })).toBe('left');
  });

  it('тап разворачивает — бесплатно и без досыпки', () => {
    expect(canPlay(withMortar, flip, options())).toBe(true);
    const step = playMove(withMortar, flip, options());
    expect(mortarFacing(step.state.board, { x: 2, y: 1 })).toBe('left');
    expect(step.cost).toBe(0);
    expect(step.move.refilled).toBe(false);
    expect(step.state.purse.swaps).toBe(5);
  });

  it('второй тап — обратно', () => {
    const once = playMove(withMortar, flip, options()).state;
    const twice = playMove(once, flip, options()).state;
    expect(mortarFacing(twice.board, { x: 2, y: 1 })).toBe('right');
  });

  it('развернуть можно только мортиру', () => {
    expect(canPlay(withMortar, { type: 'flip', at: { x: 0, y: 0 } }, options())).toBe(false);
    expect(canPlay(withMortar, { type: 'flip', at: { x: 9, y: 9 } }, options())).toBe(false);
  });
});

describe('обычное слияние из трёх — без бонуса', () => {
  it('ровно три: слияние есть, лишних клеток нет — крови сверху нет', () => {
    const rules = {
      ...options(),
      longMerge: { building: 3, potion: { raw: 4, bone: 16, obsidian: 90, crimson: 420 } },
    };
    const three: TwilightState = {
      board: boardFrom(`
        G G s G b
        t a f b s
        a f b s t
      `),
      purse: createPurse(10),
      inventory: createInventory(),
    };
    const step = playMove(three, { type: 'swap', from: { x: 2, y: 0 }, to: { x: 3, y: 0 } }, rules);
    expect(step.move.merges).toHaveLength(1);
    expect(step.mergeBonus).toBe(0);
  });
});
