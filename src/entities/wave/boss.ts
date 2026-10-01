import type { Rng } from '@/shared/lib/rng';
import { createRng } from '@/shared/lib/rng';

import type { WaveSpawn } from './types';

/**
 * Проповедник — босс (§10).
 *
 * Приходит на 10, 20, 30, 40 и 50 ночь. Перед ночью стрелка показывает столбец,
 * в котором он появится, — поэтому столбец выбирается заранее, вместе с составом
 * волны, а не в момент выхода.
 *
 * После его смерти выходит **паства** — толпа фанатиков, и не только в его
 * столбце, но и в соседних. Прорвался к воротам, не погибнув, — паства не
 * выйдет вовсе.
 *
 * Здесь только структура: сколько паствы у каждого проповедника и какие у них
 * характеристики, спека не говорит (§14 #13, #8). Числа приходят планом снаружи.
 */
export interface PreacherPlan {
  readonly kind: string;
  readonly flockKind: string;
  readonly flockSize: number;
  /** Через сколько секунд после смерти проповедника выходит паства. */
  readonly flockDelaySeconds: number;
  /** На сколько столбцов в каждую сторону расходится паства. */
  readonly flockSpread: number;
}

export interface BossPlan {
  readonly nights: readonly number[];
  readonly preachers: readonly PreacherPlan[];
}

export function isBossNight(plan: BossPlan, night: number): boolean {
  return plan.nights.includes(night);
}

/** Ближайшая ночь босса — эта или позже; null — боссы кончились. */
export function nextBossNight(plan: BossPlan, night: number): number | null {
  return plan.nights.filter((boss) => boss >= night).sort((a, b) => a - b)[0] ?? null;
}

/**
 * Какой из проповедников приходит этой ночью.
 *
 * Приходов пять, а проповедников четыре, и кто приходит пятым — спека не
 * говорит. Временное правило: последний, усиленный. Усиление в цифрах не
 * задано — §14 #17.
 */
export function preacherIndexFor(plan: BossPlan, night: number): number | null {
  const arrival = plan.nights.indexOf(night);
  if (arrival < 0) return null;
  return Math.min(arrival, plan.preachers.length - 1);
}

/** Столбцы, по которым расходится паства: его собственный и соседние. */
function flockColumns(column: number, spread: number, columns: number): number[] {
  const spots: number[] = [];
  for (let offset = 0; offset <= spread; offset++) {
    for (const candidate of offset === 0 ? [column] : [column - offset, column + offset]) {
      if (candidate >= 0 && candidate < columns && !spots.includes(candidate)) {
        spots.push(candidate);
      }
    }
  }
  return spots;
}

/**
 * Столбец, из которого выйдет проповедник, — известен заранее, ещё в
 * Сумерках: его подсвечивают, чтобы игрок успел выстроить оборону. Поэтому
 * он считается от сида забега и номера ночи, а не общим потоком волн:
 * спросить поток заранее значило бы сдвинуть его и поменять саму волну.
 */
export function bossColumn(seed: number, night: number, columns: number): number {
  const mixed = (Math.imul(seed >>> 0, 2654435761) ^ Math.imul(night, 40503)) >>> 0;
  return createRng(mixed).int(0, columns);
}

/** Проповедник и его паства одним списком выходов. */
export function bossSpawns(
  plan: BossPlan,
  night: number,
  columns: number,
  rng: Rng,
  /** Столбец, заранее показанный игроку (`bossColumn`); нет — из потока. */
  fixedColumn?: number,
): WaveSpawn[] {
  const index = preacherIndexFor(plan, night);
  if (index === null) return [];

  const preacher = plan.preachers[index] as PreacherPlan;
  const column = fixedColumn ?? rng.int(0, columns);
  const bossId = `n${String(night)}-preacher`;

  const spawns: WaveSpawn[] = [
    { id: bossId, kind: preacher.kind, column, atSecond: 0, boss: true },
  ];

  const spots = flockColumns(column, preacher.flockSpread, columns);
  for (let i = 0; i < preacher.flockSize; i++) {
    spawns.push({
      id: `${bossId}-flock-${String(i)}`,
      kind: preacher.flockKind,
      column: spots[i % spots.length] as number,
      atSecond: preacher.flockDelaySeconds,
      afterDeathOf: bossId,
    });
  }

  return spawns;
}
