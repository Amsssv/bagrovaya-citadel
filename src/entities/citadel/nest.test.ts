import { describe, expect, it } from 'vitest';

import { building, cellAt, withCells } from '@/entities/board';
import { boardFrom, pictureOf } from '@/entities/board/__testing__/boardFrom';

import { canPushToNest, createNests, nestContents, pushToNest, rotateNest } from './nest';
import type { NestSlot } from './nest';

/** Гнездо слева от левого столбца, на среднем ряду. */
const LEFT_NEST: NestSlot = { id: 'left-1', from: { x: 0, y: 1 }, direction: 'left' };
const RIGHT_NEST: NestSlot = { id: 'right-1', from: { x: 2, y: 1 }, direction: 'right' };

const board = boardFrom(`
  s t a
  G t P
  a f b
`);

describe('гнёзда цитадели (§9)', () => {
  const nests = createNests([LEFT_NEST, RIGHT_NEST]);

  it('горгулью из крайнего столбца можно втолкнуть в гнездо', () => {
    expect(canPushToNest(board, nests, { x: 0, y: 1 }, 'left')).toBe(true);
  });

  it('постройка уходит с поля в гнездо', () => {
    const result = pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'down');

    expect(cellAt(result.board, { x: 0, y: 1 }).kind).toBe('empty');
    expect(nestContents(result.nests, 'left-1')?.cell).toEqual(building('gargoyle', 'raw'));
    expect(result.slot.id).toBe('left-1');
  });

  it('свободное гнездо после толчка занято', () => {
    const result = pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'down');
    expect(canPushToNest(result.board, result.nests, { x: 0, y: 1 }, 'left')).toBe(false);
  });

  it('пустое гнездо ничего не содержит', () => {
    expect(nestContents(nests, 'left-1')).toBeNull();
  });

  it('несуществующее гнездо тоже пусто', () => {
    expect(nestContents(nests, 'нет-такого')).toBeNull();
  });

  it('не трогает исходные поле и гнёзда', () => {
    const before = pictureOf(board);
    pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'down');
    expect(pictureOf(board)).toBe(before);
    expect(nestContents(nests, 'left-1')).toBeNull();
  });
});

describe('куда толкать нельзя', () => {
  const nests = createNests([LEFT_NEST, RIGHT_NEST]);

  it('из клетки, к которой гнездо не привязано', () => {
    expect(canPushToNest(board, nests, { x: 0, y: 0 }, 'left')).toBe(false);
  });

  it('в сторону, на которую гнездо не смотрит', () => {
    expect(canPushToNest(board, nests, { x: 0, y: 1 }, 'up')).toBe(false);
  });

  it('сырой ресурс в гнездо не лезет — туда идут постройки', () => {
    const tiles = boardFrom(`
      s t a
      s t a
      a f b
    `);
    expect(canPushToNest(tiles, nests, { x: 0, y: 1 }, 'left')).toBe(false);
  });

  it('потир не постройка — в гнездо не идёт', () => {
    expect(canPushToNest(board, nests, { x: 2, y: 1 }, 'right')).toBe(false);
  });

  it('из пустой клетки', () => {
    const withHole = boardFrom(`
      s t a
      . t a
      a f b
    `);
    expect(canPushToNest(withHole, nests, { x: 0, y: 1 }, 'left')).toBe(false);
  });

  it('за краем поля', () => {
    const far = createNests([{ id: 'x', from: { x: 9, y: 9 }, direction: 'left' }]);
    expect(canPushToNest(board, far, { x: 9, y: 9 }, 'left')).toBe(false);
  });

  it('без настроенных гнёзд толкать некуда', () => {
    expect(canPushToNest(board, createNests([]), { x: 0, y: 1 }, 'left')).toBe(false);
  });

  it('pushToNest бросает, если толкать нельзя', () => {
    expect(() => pushToNest(board, nests, { x: 0, y: 0 }, 'left', 'down')).toThrow();
  });
});

describe('разворот в гнезде (§9)', () => {
  const nests = createNests([LEFT_NEST, RIGHT_NEST]);

  it('постройка встаёт в гнездо с заданным направлением', () => {
    const result = pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'up');
    expect(nestContents(result.nests, 'left-1')?.facing).toBe('up');
  });

  it('мортиру в гнезде можно развернуть', () => {
    const pushed = pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'down');
    const turned = rotateNest(pushed.nests, 'left-1', 'right');
    expect(nestContents(turned, 'left-1')?.facing).toBe('right');
  });

  it('разворот не трогает саму постройку', () => {
    const pushed = pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'down');
    const turned = rotateNest(pushed.nests, 'left-1', 'right');
    expect(nestContents(turned, 'left-1')?.cell).toEqual(building('gargoyle', 'raw'));
  });

  it('разворот не трогает исходные гнёзда', () => {
    const pushed = pushToNest(board, nests, { x: 0, y: 1 }, 'left', 'down');
    rotateNest(pushed.nests, 'left-1', 'right');
    expect(nestContents(pushed.nests, 'left-1')?.facing).toBe('down');
  });

  it('пустое гнездо разворачивать нечего', () => {
    expect(() => rotateNest(nests, 'left-1', 'up')).toThrow();
  });

  it('несуществующее гнездо — ошибка', () => {
    expect(() => rotateNest(nests, 'нет-такого', 'up')).toThrow();
  });
});

describe('башня замка — как в оригинале', () => {
  /** Башня над левым столбцом: горгулью толкают вверх из верхнего ряда. */
  const TOWER: NestSlot = {
    id: 'left',
    from: { x: 0, y: 0 },
    direction: 'up',
    accepts: ['gargoyle'],
  };
  const towers = createNests([TOWER]);
  const withBone = boardFrom(`
    G t a
    s t a
    a f b
  `);
  const upgraded = (tier: 'bone' | 'obsidian') =>
    withCells(withBone, [[{ x: 0, y: 0 }, building('gargoyle', tier)]]);

  it('принимает горгулью из верхнего ряда своего столбца', () => {
    expect(canPushToNest(withBone, towers, { x: 0, y: 0 }, 'up')).toBe(true);
  });

  it('другие постройки не принимает', () => {
    const vine = withCells(withBone, [[{ x: 0, y: 0 }, building('vine', 'crimson')]]);
    expect(canPushToNest(vine, towers, { x: 0, y: 0 }, 'up')).toBe(false);
  });

  it('занятую башню можно перевооружить только ступенью выше — старая пропадает', () => {
    const first = pushToNest(withBone, towers, { x: 0, y: 0 }, 'up', 'down');
    const refilled = upgraded('bone');
    expect(canPushToNest(refilled, first.nests, { x: 0, y: 0 }, 'up')).toBe(true);

    const second = pushToNest(refilled, first.nests, { x: 0, y: 0 }, 'up', 'down');
    expect(nestContents(second.nests, 'left')?.cell).toEqual(building('gargoyle', 'bone'));
  });

  it('той же или меньшей ступенью — нельзя', () => {
    const armed = pushToNest(upgraded('obsidian'), towers, { x: 0, y: 0 }, 'up', 'down');
    expect(canPushToNest(withBone, armed.nests, { x: 0, y: 0 }, 'up')).toBe(false);
    expect(canPushToNest(upgraded('bone'), armed.nests, { x: 0, y: 0 }, 'up')).toBe(false);
    expect(canPushToNest(upgraded('obsidian'), armed.nests, { x: 0, y: 0 }, 'up')).toBe(false);
  });
});

describe('башня, в которой лежит не постройка', () => {
  it('такую не перевооружить: сейв мог принести что угодно', () => {
    const slot: NestSlot = { id: 'left', from: { x: 0, y: 0 }, direction: 'up' };
    const odd = {
      slots: [slot],
      occupied: {
        left: { cell: { kind: 'tile', resource: 'stone' } as const, facing: 'down' as const },
      },
    };
    const withGargoyle = boardFrom(`
      G t a
      s t a
    `);
    expect(canPushToNest(withGargoyle, odd, { x: 0, y: 0 }, 'up')).toBe(false);
  });
});
