import { describe, expect, it } from 'vitest';

import { BOARD_CONFIG } from '@/shared/config/board';
import { createRng } from '@/shared/lib/rng';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { cellAt, withCells } from './board';
import { findMatches } from './match';
import {
  applyBlast,
  applyEdgeDrop,
  applyPlacement,
  applyPotionOpen,
  applySeal,
  applySwap,
  applyTeleport,
} from './resolve';
import type { ResolveOptions } from './resolve';
import { building } from './types';
import type { ResourceId } from './types';

const ALL: readonly ResourceId[] = ['stone', 'thorn', 'ash', 'fog', 'blood'];

function options(seed = 1, cascadesEnabled = false): ResolveOptions {
  return { rng: createRng(seed).fork('refill'), resources: ALL, cascadesEnabled };
}

describe('свап без тройки', () => {
  const board = boardFrom(`
    s t a f b
    t a f b s
    a f b s t
  `);

  it('ход засчитывается, поле просто меняется местами', () => {
    const result = applySwap(board, { x: 0, y: 0 }, { x: 1, y: 0 }, options());
    expect(cellAt(result.board, { x: 0, y: 0 })).toEqual(cellAt(board, { x: 1, y: 0 }));
    expect(cellAt(result.board, { x: 1, y: 0 })).toEqual(cellAt(board, { x: 0, y: 0 }));
  });

  it('троек нет, построек нет', () => {
    const result = applySwap(board, { x: 0, y: 0 }, { x: 1, y: 0 }, options());
    expect(result.matches).toEqual([]);
    expect(result.spawned).toEqual([]);
  });

  it('досыпки не было — отмена хода ещё доступна (§3)', () => {
    const result = applySwap(board, { x: 0, y: 0 }, { x: 1, y: 0 }, options());
    expect(result.refilled).toBe(false);
    expect(result.fallen.size).toBe(0);
  });

  it('запрещённый свап бросает', () => {
    expect(() => applySwap(board, { x: 0, y: 0 }, { x: 1, y: 1 }, options())).toThrow();
  });
});

describe('постройка встаёт туда, куда двигали', () => {
  it('горизонтальная тройка: постройка на клетке назначения', () => {
    //  Тащим камень справа налево в позицию (2,0), замыкая тройку.
    const board = boardFrom(`
      s s t s b
      f b a f s
      a f b a t
    `);
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());

    expect(result.spawned).toHaveLength(1);
    expect(result.spawned[0]?.position).toEqual({ x: 2, y: 0 });
    expect(result.spawned[0]?.cell).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'raw',
    });
  });

  it('вертикальная тройка: постройка появляется на клетке назначения и проваливается вниз', () => {
    // Камни в столбце 0 на y=1 и y=2; тащим камень из (1,0) в (0,0).
    const board = boardFrom(`
      t s
      s b
      s f
    `);
    const result = applySwap(board, { x: 1, y: 0 }, { x: 0, y: 0 }, options());

    expect(result.spawned[0]?.position).toEqual({ x: 0, y: 0 });
    // После гравитации постройка на дне столбца, сверху досыпано.
    expect(cellAt(result.board, { x: 0, y: 2 })).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'raw',
    });
  });

  it('один свап может замкнуть две тройки — по постройке на каждую', () => {
    const board = boardFrom(`
      s s a t b
      t t s b f
      f b a t s
      b f a s t
    `);
    const result = applySwap(board, { x: 2, y: 0 }, { x: 2, y: 1 }, options());

    const spawned = result.spawned
      .map((item) => `${item.cell.kind === 'building' ? item.cell.building : item.cell.kind}`)
      .sort((a, b) => a.localeCompare(b));
    expect(spawned).toEqual(['gargoyle', 'mortar']);
  });
});

describe('что рождает каждый ресурс (§5)', () => {
  const cases: [ResourceId, string, string][] = [
    ['stone', 's', 'gargoyle'],
    ['thorn', 't', 'vine'],
    ['ash', 'a', 'mortar'],
    ['fog', 'f', 'fogveil'],
  ];

  for (const [resource, glyph, expected] of cases) {
    it(`${resource} → ${expected}`, () => {
      const board = boardFrom(`
        ${glyph} ${glyph} b ${glyph} .
        b . . . .
        . . . . .
      `);
      const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
      expect(result.spawned[0]?.cell).toEqual({
        kind: 'building',
        building: expected,
        tier: 'raw',
      });
    });
  }

  it('кровь → потир, а не постройка', () => {
    const board = boardFrom(`
      b b s b .
      s . . . .
      . . . . .
    `);
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    expect(result.spawned[0]?.cell).toEqual({ kind: 'potion', tier: 'raw' });
  });

  it('новое всегда первой ступени', () => {
    const board = boardFrom(`
      s s b s .
      b . . . .
      . . . . .
    `);
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    const cell = result.spawned[0]?.cell;
    expect(cell?.kind === 'building' ? cell.tier : null).toBe('raw');
  });
});

describe('после тройки', () => {
  const board = boardFrom(`
    s s t s b
    f b a f s
    a f b a t
  `);

  it('поле снова заполнено', () => {
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    expect(result.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
  });

  it('досыпка была — ход зафиксирован, отмены уже нет (§3)', () => {
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    expect(result.refilled).toBe(true);
  });

  it('карта высот падения не пустая', () => {
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    expect(result.fallen.size).toBeGreaterThan(0);
  });

  it('на одном сиде результат один и тот же', () => {
    const first = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options(9));
    const second = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options(9));
    expect(pictureOf(first.board)).toBe(pictureOf(second.board));
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    expect(pictureOf(board)).toBe(before);
  });
});

describe('без досыпки — выходной', () => {
  const board = boardFrom(`
    s s t s b
    f b a f s
    a f b a t
  `);

  it('плитки оседают, сверху остаются пустые клетки', () => {
    const result = applySwap(
      board,
      { x: 3, y: 0 },
      { x: 2, y: 0 },
      { ...options(), refill: false },
    );
    expect(result.board.cells.filter((cell) => cell.kind === 'empty')).toHaveLength(2);
  });

  it('досыпки не было — ход можно отменить', () => {
    const result = applySwap(
      board,
      { x: 3, y: 0 },
      { x: 2, y: 0 },
      { ...options(), refill: false },
    );
    expect(result.refilled).toBe(false);
  });
});

describe('каскады', () => {
  // Досыпка идёт из потока `refill` и может сама сложить тройку. Считается ли
  // это — §14 #6, пока выключено флагом.
  //
  // Поле подобрано так, что после тройки в среднем ряду сверху досыпаются два
  // камня и вместе с уже лежавшим третьим замыкают новую тройку в верхнем ряду.
  const board = boardFrom(`
    a b s t f
    s s t s b
    f a b f a
  `);
  const onlyStone = (cascadesEnabled: boolean): ResolveOptions => ({
    rng: createRng(1).fork('refill'),
    resources: ['stone'],
    cascadesEnabled,
  });

  it('по умолчанию выключены: сложившееся после досыпки не разбирается', () => {
    const result = applySwap(board, { x: 3, y: 1 }, { x: 2, y: 1 }, onlyStone(false));
    expect(result.spawned).toHaveLength(1);
    // Тройка наверху есть, но её оставили в покое.
    expect(findMatches(result.board).length).toBeGreaterThan(0);
  });

  it('включённые каскады разбирают то, что сложилось после досыпки', () => {
    const result = applySwap(board, { x: 3, y: 1 }, { x: 2, y: 1 }, onlyStone(true));
    expect(result.spawned.length).toBeGreaterThan(1);
  });

  it('каскады всегда останавливаются: каждый круг превращает плитки в постройку', () => {
    const result = applySwap(board, { x: 3, y: 1 }, { x: 2, y: 1 }, onlyStone(true));
    expect(findMatches(result.board)).toEqual([]);
  });
});

describe('слияние в ходе', () => {
  it('свап без тройки может замкнуть слияние', () => {
    // Двигаем горгулью снизу вверх, к двум уже стоящим в ряд.
    const board = boardFrom(`
      G G s t
      t a G f
      f t a s
    `);
    const result = applySwap(board, { x: 2, y: 1 }, { x: 2, y: 0 }, options());

    expect(result.matches).toEqual([]);
    expect(result.merges).toHaveLength(1);
    expect(result.merges[0]?.into).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'bone',
    });
  });

  it('слитая постройка встаёт на клетку назначения', () => {
    const board = boardFrom(`
      G G s t
      t a G f
      f t a s
    `);
    const result = applySwap(board, { x: 2, y: 1 }, { x: 2, y: 0 }, options());
    expect(result.merges[0]?.position).toEqual({ x: 2, y: 0 });
  });

  it('постройка от тройки тут же сливается с двумя соседними', () => {
    const board = boardFrom(`
      s s t s f
      b a G t b
      f t G a s
    `);
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());

    expect(result.spawned).toHaveLength(1);
    expect(result.merges).toHaveLength(1);
    // Слитая горгулья проваливается на дно опустевшего столбца.
    expect(cellAt(result.board, { x: 2, y: 2 })).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'bone',
    });
  });

  it('слияние тоже фиксирует ход: освободившиеся клетки досыпаются', () => {
    const board = boardFrom(`
      G G s t
      t a G f
      f t a s
    `);
    const result = applySwap(board, { x: 2, y: 1 }, { x: 2, y: 0 }, options());
    expect(result.refilled).toBe(true);
    expect(result.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
  });

  it('свап без тройки и без слияния поле не досыпает', () => {
    const board = boardFrom(`
      s t a f b
      t a f b s
      a f b s t
    `);
    const result = applySwap(board, { x: 0, y: 0 }, { x: 1, y: 0 }, options());
    expect(result.merges).toEqual([]);
    expect(result.refilled).toBe(false);
  });
});

describe('защита от бесконечного круга', () => {
  it('превышение предела кругов — ошибка, а не зависание', () => {
    const board = boardFrom(`
      a b s t f
      s s t s b
      f a b f a
    `);
    expect(() =>
      applySwap(
        board,
        { x: 3, y: 1 },
        { x: 2, y: 1 },
        {
          rng: createRng(1).fork('refill'),
          resources: ['stone'],
          cascadesEnabled: true,
          maxRounds: 1,
        },
      ),
    ).toThrow(/круг/i);
  });
});

describe('сброс за край как ход', () => {
  const board = boardFrom(`
    s t a f b
    t a f b s
    a f b s t
  `);

  it('ресурс уходит с поля, дыра закрывается досыпкой', () => {
    const result = applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options());
    expect(result.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
    expect(result.refilled).toBe(true);
  });

  it('досыпка что-то роняет — карта высот не пустая', () => {
    const result = applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options());
    expect(result.fallen.size).toBeGreaterThan(0);
  });

  it('сам по себе тройку не замыкает: он только убирает', () => {
    const result = applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options());
    expect(result.matches).toEqual([]);
    expect(result.spawned).toEqual([]);
  });

  it('осевшие углом (буквой Г) постройки не сливаются', () => {
    // Убираем камень снизу слева: две горгульи над ним оседают и встают углом
    // к третьей, в соседнем столбце. Угол — не линия.
    const withGargoyles = boardFrom(`
      G t a
      G f b
      s G b
    `);
    const result = applyEdgeDrop(withGargoyles, { x: 0, y: 2 }, 'left', options());

    expect(result.merges).toEqual([]);
  });

  it('но осевшие постройки могут встать в линию и слиться', () => {
    // Убираем камень слева в середине: горгулья над ним оседает и встаёт в ряд
    // с двумя другими.
    const withGargoyles = boardFrom(`
      G t a
      s G G
      t a b
    `);
    const result = applyEdgeDrop(withGargoyles, { x: 0, y: 1 }, 'left', options());

    expect(result.merges).toHaveLength(1);
    expect(result.merges[0]?.into).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'bone',
    });
  });

  it('запрещённый сброс бросает', () => {
    expect(() => applyEdgeDrop(board, { x: 0, y: 0 }, 'up', options())).toThrow();
    expect(() => applyEdgeDrop(board, { x: 1, y: 0 }, 'left', options())).toThrow();
  });

  it('на одном сиде результат один и тот же', () => {
    const first = applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options(5));
    const second = applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options(5));
    expect(pictureOf(first.board)).toBe(pictureOf(second.board));
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options());
    expect(pictureOf(board)).toBe(before);
  });
});

describe('вскрытие потира как ход', () => {
  const board = boardFrom(`
    s t a f b
    t P f b s
    a f b s t
  `);

  it('потир уходит, ступень возвращается, поле снова полное', () => {
    const result = applyPotionOpen(board, { x: 1, y: 1 }, options());
    expect(result.tier).toBe('raw');
    expect(result.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
    expect(result.refilled).toBe(true);
  });

  it('троек само по себе не замыкает', () => {
    const result = applyPotionOpen(board, { x: 1, y: 1 }, options());
    expect(result.matches).toEqual([]);
  });

  it('там, где потира нет, бросает', () => {
    expect(() => applyPotionOpen(board, { x: 0, y: 0 }, options())).toThrow();
  });

  it('на одном сиде результат один и тот же', () => {
    const first = applyPotionOpen(board, { x: 1, y: 1 }, options(4));
    const second = applyPotionOpen(board, { x: 1, y: 1 }, options(4));
    expect(pictureOf(first.board)).toBe(pictureOf(second.board));
  });

  it('не трогает исходное поле', () => {
    const before = pictureOf(board);
    applyPotionOpen(board, { x: 1, y: 1 }, options());
    expect(pictureOf(board)).toBe(before);
  });
});

describe('ход отдаёт шаги для анимации', () => {
  const plain = boardFrom(`
    s t a f b
    t a f b s
    a f b s t
  `);

  it('свап без тройки — один шаг, и на нём уже итоговое поле', () => {
    const result = applySwap(plain, { x: 0, y: 0 }, { x: 1, y: 0 }, options());
    expect(result.stages.map((stage) => stage.kind)).toEqual(['action']);
    expect(result.stages[0]?.board).toBe(result.board);
  });

  it('свап помечает две сдвинутые клетки', () => {
    const result = applySwap(plain, { x: 0, y: 0 }, { x: 1, y: 0 }, options());
    expect(result.stages[0]?.moved).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it('тройка даёт шаги: ход, сбор, оседание', () => {
    const board = boardFrom(`
      s s t s b
      f b a f s
      a f b a t
    `);
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    expect(result.stages.map((stage) => stage.kind)).toEqual(['action', 'reap', 'settle']);
  });

  it('на шаге сбора видно, что исчезло и что появилось', () => {
    const board = boardFrom(`
      s s t s b
      f b a f s
      a f b a t
    `);
    const reap = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options()).stages[1];
    expect(reap?.removed).toHaveLength(3);
    expect(reap?.appeared).toEqual([{ x: 2, y: 0 }]);
  });

  it('слияние — отдельный шаг', () => {
    const board = boardFrom(`
      G G s t
      t a G f
      f t a s
    `);
    const result = applySwap(board, { x: 2, y: 1 }, { x: 2, y: 0 }, options());
    expect(result.stages.map((stage) => stage.kind)).toEqual(['action', 'merge', 'settle']);
    expect(result.stages[1]?.removed).toHaveLength(3);
  });

  it('шаг оседания несёт карту высот падения', () => {
    const board = boardFrom(`
      s s t s b
      f b a f s
      a f b a t
    `);
    const result = applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options());
    const settle = result.stages.at(-1);
    expect(settle?.kind).toBe('settle');
    expect(settle?.fallen.size).toBeGreaterThan(0);
  });

  it('последний шаг всегда совпадает с итоговым полем', () => {
    const board = boardFrom(`
      s s t s b
      f b a f s
      a f b a t
    `);
    for (const move of [
      () => applySwap(board, { x: 3, y: 0 }, { x: 2, y: 0 }, options()),
      () => applyEdgeDrop(board, { x: 0, y: 0 }, 'left', options()),
    ]) {
      const result = move();
      expect(result.stages.at(-1)?.board).toBe(result.board);
    }
  });

  it('сброс за край начинается с исчезнувшей клетки', () => {
    const result = applyEdgeDrop(plain, { x: 0, y: 0 }, 'left', options());
    expect(result.stages[0]?.kind).toBe('action');
    expect(result.stages[0]?.removed).toEqual([{ x: 0, y: 0 }]);
  });

  it('вскрытие потира — тоже действие с исчезновением', () => {
    const withPotion = boardFrom(`
      s t a f b
      t P f b s
      a f b s t
    `);
    const result = applyPotionOpen(withPotion, { x: 1, y: 1 }, options());
    expect(result.stages[0]?.removed).toEqual([{ x: 1, y: 1 }]);
  });
});

describe('каскады включены в боевом конфиге', () => {
  it('сложившееся при досыпке схлопывается само', () => {
    expect(BOARD_CONFIG.cascadesEnabled).toBe(true);
  });

  it('и на боевой настройке ход доигрывается до состояния без троек', () => {
    const board = boardFrom(`
      a b s t f
      s s t s b
      f a b f a
    `);
    const result = applySwap(
      board,
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      {
        rng: createRng(1).fork('refill'),
        resources: ['stone'],
        cascadesEnabled: BOARD_CONFIG.cascadesEnabled,
      },
    );
    expect(findMatches(result.board)).toEqual([]);
  });
});

describe('ходы предметами (§11)', () => {
  const board = boardFrom(`
    s t a f b
    t P f b s
    a f b s t
    f b s t a
  `);

  it('проклятый прах убирает клетку и поле досыпается', () => {
    const result = applyBlast(board, { x: 1, y: 1 }, options());
    expect(result.stages[0]?.removed).toEqual([{ x: 1, y: 1 }]);
    expect(result.board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
    expect(result.matches).toEqual([]);
  });

  it('нетопыри меняют местами далёкие клетки', () => {
    const result = applyTeleport(board, { x: 0, y: 0 }, { x: 4, y: 3 }, options());
    expect(result.stages[0]?.moved).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 3 },
    ]);
  });

  it('нетопыри могут замкнуть тройку', () => {
    const ready = boardFrom(`
      s s t f b
      t a f b s
      a f b s s
      f b s t a
    `);
    const result = applyTeleport(ready, { x: 2, y: 0 }, { x: 4, y: 2 }, options());
    expect(result.spawned).toHaveLength(1);
  });

  it('столб тумана встаёт на плитку', () => {
    const veil = building('fogveil', 'raw');
    const result = applyPlacement(board, { x: 0, y: 0 }, veil, options());
    expect(result.stages[0]?.appeared).toEqual([{ x: 0, y: 0 }]);
    expect(cellAt(result.board, { x: 0, y: 0 })).toEqual(veil);
  });

  it('печать поднимает постройку и может тут же замкнуть слияние', () => {
    const almost = withCells(board, [
      [{ x: 0, y: 0 }, building('gargoyle', 'bone')],
      [{ x: 1, y: 0 }, building('gargoyle', 'bone')],
      [{ x: 2, y: 0 }, building('gargoyle', 'raw')],
    ]);
    const result = applySeal(almost, { x: 2, y: 0 }, 'bone', options());
    expect(result.merges).toHaveLength(1);
    expect(result.merges[0]?.into).toEqual(building('gargoyle', 'obsidian'));
  });

  it('невозможный ход предметом бросает', () => {
    expect(() => applyBlast(board, { x: 9, y: 9 }, options())).toThrow();
    expect(() => applyTeleport(board, { x: 0, y: 0 }, { x: 0, y: 0 }, options())).toThrow();
    expect(() =>
      applyPlacement(board, { x: 1, y: 1 }, building('fogveil', 'raw'), options()),
    ).toThrow();
    expect(() => applySeal(board, { x: 0, y: 0 }, 'bone', options())).toThrow();
  });
});
