import type { Board } from '@/entities/board';
import type { BuildingBook } from '@/entities/building';
import type { Citadel, Nests } from '@/entities/citadel';
import type { EnemyBook, Hunter } from '@/entities/enemy';
import type { Position } from '@/shared/lib/geometry';

/** Что стоит на поле к началу Рассвета. */
export interface NightState {
  readonly board: Board;
  readonly citadel: Citadel;
  readonly night: number;
  /** Башни замка: что в них стоит, стреляет вместе с полем. */
  readonly nests?: Nests | undefined;
}

export interface WaveSpawn {
  readonly id: string;
  readonly kind: string;
  readonly column: number;
  /**
   * Через сколько секунд выходит. Обычно — от начала Рассвета; если задан
   * `afterDeathOf`, то от смерти того охотника.
   */
  readonly atSecond: number;
  /**
   * Выходит не по часам, а следом за чужой смертью — паства проповедника (§10).
   * Если тот прорвался к воротам и не погиб, эти вовсе не выйдут.
   */
  readonly afterDeathOf?: string;
  /** Босс ночи: его гибель — цель, за которую начисляются очки. */
  readonly boss?: boolean;
}

export interface WaveConfig {
  readonly spawns: readonly WaveSpawn[];
}

export type NightOutcome = 'cleared' | 'citadel-fell' | 'timeout';

/**
 * Лог событий — то, ради чего бой считается целиком до анимации. Сцена его
 * проигрывает, тесты и бот читают напрямую, баг-репорт воспроизводится по нему
 * же. Время `at` — миллисекунды от начала Рассвета.
 */
export type NightEvent =
  | {
      readonly type: 'spawn';
      readonly at: number;
      readonly id: string;
      readonly kind: string;
      readonly column: number;
      /** Где появился: ниже поля, в его нижнем ряду или там, где пал проповедник. */
      readonly y?: number;
      /** Сколько жизней вышло — для полоски жизней босса. */
      readonly hp?: number;
      /** Это босс: у него внизу полоска жизней, как в оригинале. */
      readonly boss?: boolean;
    }
  | {
      readonly type: 'move';
      readonly at: number;
      readonly id: string;
      readonly from: number;
      readonly to: number;
      /** Точная дробная координата в этот момент — сцене, чтобы спрайт не отставал. */
      readonly y: number;
    }
  /**
   * Враг вошёл в полосу тумана или вышел из неё: темп шага поменялся. Сцене —
   * чтобы замедление было видно там, где оно есть, а не размазывалось на
   * всю клетку.
   */
  | {
      readonly type: 'pace';
      readonly at: number;
      readonly id: string;
      readonly y: number;
      /** Во сколько раз режется скорость: 1 — идёт как обычно. */
      readonly factor: number;
    }
  | {
      readonly type: 'shot';
      readonly at: number;
      readonly from: Position;
      readonly targets: readonly string[];
      readonly damage: number;
    }
  | {
      readonly type: 'hit';
      readonly at: number;
      readonly id: string;
      readonly amount: number;
      readonly hpLeft: number;
      /** Откуда стреляли — сцене, чтобы вспышка попадания была своя у постройки. */
      readonly from?: Position;
    }
  | {
      readonly type: 'kill';
      readonly at: number;
      readonly id: string;
      readonly column: number;
      /** Где именно погиб: обычно посреди клетки, а не в её центре. */
      readonly y: number;
    }
  | {
      readonly type: 'leak';
      readonly at: number;
      readonly id: string;
      readonly column: number;
      readonly damage: number;
      readonly heartsLeft: number;
      readonly y: number;
    }
  | {
      readonly type: 'end';
      readonly at: number;
      readonly reason: NightOutcome;
    };

export interface NightResult {
  readonly citadel: Citadel;
  readonly events: readonly NightEvent[];
  readonly outcome: NightOutcome;
  readonly killed: number;
  /** Сколько из убитых — боссы. */
  readonly bossesKilled: number;
  /** Сколько охотников дошло до ворот. */
  readonly leaked: number;
  /** Кто остался на поле, если ночь оборвалась по пределу расчёта. */
  readonly survivors: readonly Hunter[];
  readonly durationMs: number;
}

export interface SimulateOptions {
  readonly enemies: EnemyBook;
  readonly buildings: BuildingBook;
  /** Шаг расчёта. Не правило игры, а разрешение симуляции. */
  readonly tickMs: number;
  /** Предохранитель от бесконечной ночи. */
  readonly maxSeconds: number;
  /** Радиус огня из башни замка. Не задан — как у постройки на поле. */
  readonly turretRange?: number | undefined;
  /**
   * Скорость снаряда, клеток в секунду. Задана — снаряды летят, и урон
   * приходится на момент попадания (как в оригинале); нет — попадание сразу.
   */
  readonly projectileSpeed?: number | undefined;
  /**
   * На сколько клеток ниже нижнего ряда появляются враги — в оригинале на
   * четыре: колонна подлетает к полю снизу. Не задано — прямо в нижнем ряду.
   */
  readonly spawnDepth?: number | undefined;
  /**
   * Сколько рядов под полем уже простреливается: туда достают лоза по своему
   * столбцу и горгульи нижнего ряда. В оригинале — три. Не задано — ни одного.
   */
  readonly shootDepth?: number | undefined;
}
