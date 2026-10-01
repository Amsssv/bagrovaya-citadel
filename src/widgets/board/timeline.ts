import type { MoveStage } from '@/entities/board';
import type { Position } from '@/shared/lib/geometry';

/**
 * Длительности шагов анимации. Домен считает ход мгновенно, поэтому эти числа
 * ни на что в игре не влияют — только на то, успевает ли глаз.
 */
export const DURATION = {
  swap: 150,
  vanish: 130,
  pop: 170,
  /** На одну клетку падения; дальше растёт, но не линейно. */
  fallPerCell: 70,
  fallMin: 120,
} as const;

export type Speed = 1 | 2;

/**
 * Раздача нового поля: плитки падают сверху и заполняют его ряд за рядом,
 * снизу вверх — как обычная досыпка, только на всё поле сразу.
 */
export const DEAL = {
  /** Задержка между рядами: нижний ложится первым. */
  rowMs: 70,
  /** Лёгкий сдвиг по столбцам, чтобы ряд не падал одной доской. */
  columnMs: 18,
} as const;

/** Через сколько после начала раздачи клетка начинает падать. */
export function dealDelay(cell: Position, height: number): number {
  return (height - 1 - cell.y) * DEAL.rowMs + cell.x * DEAL.columnMs;
}

/** Сколько длится вся раздача поля такого размера. */
export function dealDuration(width: number, height: number): number {
  return dealDelay({ x: width - 1, y: 0 }, height) + fallDuration(height);
}

/** Сколько миллисекунд займёт падение на столько клеток. */
export function fallDuration(distance: number): number {
  return Math.max(DURATION.fallMin, Math.sqrt(distance) * DURATION.fallPerCell * 1.6);
}

/** Сколько всего продлится проигрывание шагов на этой скорости. */
export function totalDuration(stages: readonly MoveStage[], speed: Speed): number {
  let total = 0;
  for (const stage of stages) {
    total += stageDuration(stage);
  }
  return total / speed;
}

export function stageDuration(stage: MoveStage): number {
  switch (stage.kind) {
    case 'action':
      return stage.moved.length > 0 ? DURATION.swap : DURATION.vanish;
    case 'reap':
    case 'merge':
      return DURATION.vanish + DURATION.pop;
    case 'settle': {
      let longest = 0;
      for (const distance of stage.fallen.values()) {
        longest = Math.max(longest, fallDuration(distance));
      }
      return longest;
    }
  }
}

/**
 * Куда сходятся исчезающие постройки при слиянии — в клетку, где встала новая
 * (§6). `null` — сходиться не к чему, и тогда они просто гаснут на месте.
 *
 * Если появилось не одно, угадывать не беремся: лучше показать честное
 * исчезновение, чем свести три постройки не туда.
 */
export function mergeFocus(stage: MoveStage): Position | null {
  if (stage.kind !== 'merge') return null;

  const [first, ...rest] = stage.appeared;
  if (first === undefined || rest.length > 0) return null;
  return first;
}

const keyOf = (cell: Position): string => `${String(cell.x)},${String(cell.y)}`;

/**
 * Куда стягивается каждая исчезающая клетка: в ту клетку своей группы, где
 * встаёт новое — постройка из тройки или постройка ступенью выше из слияния.
 * Так три плитки читаются как одно превращение, а не как три хлопка.
 *
 * Ключ — «x,y» исчезающей клетки. Клетки без цели (у группы ничего не
 * появилось) в карту не попадают: они просто гаснут на месте.
 */
export function gatherTargets(stage: MoveStage): Map<string, Position> {
  const targets = new Map<string, Position>();
  if (stage.kind !== 'reap' && stage.kind !== 'merge') return targets;

  const appeared = new Set(stage.appeared.map(keyOf));
  for (const group of stage.groups) {
    const focus = group.find((cell) => appeared.has(keyOf(cell)));
    if (focus === undefined) continue;
    for (const cell of group) targets.set(keyOf(cell), focus);
  }
  return targets;
}
