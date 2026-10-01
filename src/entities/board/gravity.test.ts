import { describe, expect, it } from 'vitest';

import { createRng } from '@/shared/lib/rng';

import { boardFrom, pictureOf } from './__testing__/boardFrom';
import { refill, settle, settleAndRefill } from './gravity';
import type { ResourceId } from './types';

const ONLY_STONE: readonly ResourceId[] = ['stone'];
const ALL: readonly ResourceId[] = ['stone', 'thorn', 'ash', 'fog', 'blood'];

describe('settle — падает всё', () => {
  it('содержимое оседает вниз, пустота собирается сверху', () => {
    const { board } = settle(
      boardFrom(`
        s t a
        . f b
        s . t
      `),
    );
    expect(pictureOf(board)).toBe(['. . a', 's t b', 's f t'].join('\n'));
  });

  it('постройка падает наравне с плитками', () => {
    const { board } = settle(
      boardFrom(`
        G t a
        . f b
        . a t
      `),
    );
    expect(pictureOf(board)).toBe(['. t a', '. f b', 'G a t'].join('\n'));
  });

  it('потир тоже падает', () => {
    const { board } = settle(
      boardFrom(`
        P t a
        . f b
        . a t
      `),
    );
    expect(pictureOf(board)).toBe(['. t a', '. f b', 'P a t'].join('\n'));
  });

  it('порядок внутри столбца сохраняется', () => {
    const { board } = settle(
      boardFrom(`
        s
        t
        .
      `),
    );
    expect(pictureOf(board)).toBe(['.', 's', 't'].join('\n'));
  });

  it('уже осевшее поле не меняется', () => {
    const before = boardFrom(`
      . . .
      s t a
      f b s
    `);
    const { board, fallen } = settle(before);
    expect(pictureOf(board)).toBe(pictureOf(before));
    expect(fallen.size).toBe(0);
  });

  it('пустой столбец остаётся пустым', () => {
    const { board, fallen } = settle(
      boardFrom(`
        . s
        . t
      `),
    );
    expect(pictureOf(board)).toBe(['. s', '. t'].join('\n'));
    expect(fallen.size).toBe(0);
  });

  it('не трогает исходное поле', () => {
    const board = boardFrom(`
      s t
      . f
    `);
    const before = pictureOf(board);
    settle(board);
    expect(pictureOf(board)).toBe(before);
  });
});

describe('settle — карта высот падения', () => {
  it('записывает, на сколько клеток упала каждая сдвинувшаяся', () => {
    // Столбец 0: камень с y=0 падает на y=2 — две клетки.
    const { fallen } = settle(
      boardFrom(`
        s t a
        . f b
        . a t
      `),
    );
    expect(fallen.get(2 * 3 + 0)).toBe(2);
  });

  it('несдвинувшихся клеток в карте нет', () => {
    const { fallen } = settle(
      boardFrom(`
        s t a
        . f b
        . a t
      `),
    );
    expect(fallen.has(2 * 3 + 1)).toBe(false);
    expect(fallen.has(2 * 3 + 2)).toBe(false);
  });

  it('две дырки под клеткой дают падение на две', () => {
    const { fallen } = settle(
      boardFrom(`
        s
        .
        .
      `),
    );
    expect([...fallen.entries()]).toEqual([[2, 2]]);
  });

  it('высота считается до ближайшей преграды снизу, а не до края поля', () => {
    // Под камнем одна дырка, ниже — постройка. Камень падает ровно на одну.
    const { fallen } = settle(
      boardFrom(`
        s
        .
        G
      `),
    );
    expect([...fallen.entries()]).toEqual([[1, 1]]);
  });
});

describe('refill — новые плитки приходят сверху, со стороны цитадели', () => {
  it('заполняет все пустые клетки', () => {
    const { board } = refill(
      boardFrom(`
        . .
        . s
        t a
      `),
      createRng(1).fork('refill'),
      ONLY_STONE,
    );
    expect(pictureOf(board)).toBe(['s s', 's s', 't a'].join('\n'));
  });

  it('новые клетки — сырые плитки из переданного списка', () => {
    const { board } = refill(
      boardFrom(`
        . .
        t a
      `),
      createRng(1).fork('refill'),
      ALL,
    );
    const fresh = board.cells.slice(0, 2);
    expect(fresh.every((cell) => cell.kind === 'tile')).toBe(true);
  });

  it('высота падения новой плитки — сколько их пришло в этот столбец', () => {
    // Слева две новые плитки, справа одна.
    const { fallen } = refill(
      boardFrom(`
        . .
        . s
        t a
      `),
      createRng(1).fork('refill'),
      ONLY_STONE,
    );
    expect(fallen.get(0)).toBe(2);
    expect(fallen.get(2)).toBe(2);
    expect(fallen.get(1)).toBe(1);
  });

  it('на одном сиде даёт одну и ту же раздачу', () => {
    const holes = boardFrom(`
      . . .
      . . .
      t a s
    `);
    const first = refill(holes, createRng(7).fork('refill'), ALL);
    const second = refill(holes, createRng(7).fork('refill'), ALL);
    expect(pictureOf(first.board)).toBe(pictureOf(second.board));
  });

  it('полю без дырок досыпать нечего', () => {
    const full = boardFrom(`
      s t
      a f
    `);
    const { board, fallen } = refill(full, createRng(1).fork('refill'), ALL);
    expect(pictureOf(board)).toBe(pictureOf(full));
    expect(fallen.size).toBe(0);
  });
});

describe('settleAndRefill', () => {
  it('поле после дырок снова полное', () => {
    const { board } = settleAndRefill(
      boardFrom(`
        s . a
        . f .
        t . s
      `),
      createRng(3).fork('refill'),
      ONLY_STONE,
    );
    expect(board.cells.every((cell) => cell.kind !== 'empty')).toBe(true);
  });

  it('карта высот покрывает и осевшее, и новое', () => {
    // Столбец из одной плитки и одной дырки под ней: плитка падает на 1,
    // сверху приходит одна новая и тоже летит 1.
    const { fallen } = settleAndRefill(
      boardFrom(`
        s
        .
      `),
      createRng(3).fork('refill'),
      ONLY_STONE,
    );
    expect(fallen.get(1)).toBe(1);
    expect(fallen.get(0)).toBe(1);
  });

  it('постройка проваливается в дырку под собой, а сверху досыпается плитка', () => {
    // Ровно случай из спеки: вертикальная тройка ушла, постройка падает вниз.
    const { board } = settleAndRefill(
      boardFrom(`
        G
        .
        .
      `),
      createRng(3).fork('refill'),
      ONLY_STONE,
    );
    expect(pictureOf(board)).toBe(['s', 's', 'G'].join('\n'));
  });
});
