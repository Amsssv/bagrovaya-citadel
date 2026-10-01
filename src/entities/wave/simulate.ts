import type { Board, Cell, FireSpec } from '@/entities/board';
import { coveredCells, positionAt } from '@/entities/board';
import type { BuildingBook, BuildingSpec, TierStats } from '@/entities/building';
import { specFor as buildingSpec, statsFor } from '@/entities/building';
import type { Citadel, Nests } from '@/entities/citadel';
import { damageCitadel, isFallen } from '@/entities/citadel';
import type { Hunter } from '@/entities/enemy';
import { cellOf, specFor as enemySpec, statsAt } from '@/entities/enemy';
import type { Direction, Position } from '@/shared/lib/geometry';
import { step } from '@/shared/lib/geometry';

import type {
  NightEvent,
  NightOutcome,
  NightResult,
  NightState,
  SimulateOptions,
  WaveConfig,
  WaveSpawn,
} from './types';

/** Живой охотник внутри расчёта — в отличие от Hunter, меняется по месту. */
interface Live {
  readonly id: string;
  readonly kind: string;
  readonly column: number;
  readonly boss: boolean;
  readonly maxHp: number;
  y: number;
  hp: number;
  /** Сколько снарядов летит в него прямо сейчас. */
  incoming: number;
  /** Темп шага на прошлом тике: 1 — вне тумана. */
  pace: number;
}

/** Снаряд в полёте: урон придёт, когда долетит. */
interface Flight {
  readonly targetId: string;
  readonly turret: Turret;
  readonly damage: number;
  readonly arriveAt: number;
  /** Летел вверх — туда же ищет новую цель болт, если прежняя погибла. */
  readonly up: boolean;
}

/** Постройка на поле, готовая стрелять. */
interface Turret {
  readonly position: Position;
  readonly spec: BuildingSpec;
  readonly stats: TierStats;
  readonly fire: FireSpec;
  readonly facing: Direction;
  /** Куда смотрит по горизонтали: для выбора цели мортирой. */
  readonly side: 1 | -1;
  /** Сколько секунд осталось до выстрела. */
  cooldown: number;
}

/**
 * Мортира в оригинале смотрит вправо, а поставленная у правого края — влево;
 * развернуть её можно тапом (`facing` клетки).
 */
function sideOf(cell: Cell, position: Position, width: number): 1 | -1 {
  if (cell.kind === 'building' && cell.facing !== undefined) return cell.facing === 'left' ? -1 : 1;
  return position.x >= width - 2 ? -1 : 1;
}

function fireSpecOf(spec: BuildingSpec, stats: TierStats): FireSpec {
  return {
    pattern: spec.pattern,
    aroundShape: spec.aroundShape,
    range: stats.range,
    blockedByBuildings: spec.blockedByBuildings,
  };
}

function turretOf(
  book: BuildingBook,
  cell: Cell,
  position: Position,
  width: number,
  range?: number,
): Turret | null {
  if (cell.kind !== 'building') return null;
  const spec = buildingSpec(book, cell.building);
  const base = statsFor(book, cell.building, cell.tier);
  const stats = range === undefined ? base : { ...base, range };
  return {
    position,
    spec,
    stats,
    fire: fireSpecOf(spec, stats),
    facing: spec.defaultFacing,
    side: sideOf(cell, position, width),
    cooldown: 0,
  };
}

/**
 * Кто стреляет: постройки поля в порядке обхода клеток — от него зависит
 * воспроизводимость, — и следом башни замка. Башня стоит за краем поля, в
 * клетке, куда в неё толкали (для верхнего ряда — рядом выше поля), и бьёт
 * по полю со своим радиусом.
 */
function collectTurrets(
  board: Board,
  book: BuildingBook,
  nests: Nests | undefined,
  turretRange: number | undefined,
): Turret[] {
  const turrets: Turret[] = [];

  board.cells.forEach((cell: Cell, index: number) => {
    const turret = turretOf(book, cell, positionAt(board, index), board.width);
    if (turret !== null) turrets.push(turret);
  });

  for (const slot of nests?.slots ?? []) {
    const contents = nests?.occupied[slot.id];
    if (contents === undefined) continue;
    const turret = turretOf(
      book,
      contents.cell,
      step(slot.from, slot.direction),
      board.width,
      turretRange,
    );
    if (turret !== null) turrets.push({ ...turret, facing: contents.facing });
  }

  return turrets;
}

/**
 * Разлёт паствы — как в оригинале: прихожане вылетают из того места, где пал
 * проповедник, каждый в свою сторону, на 5…(20 + 0,6 × ночь) точек клетки 48.
 * Без разлёта десяток стоял бы в одной точке, и со стороны это выглядело бы
 * одним живучим врагом.
 *
 * Сторона и дальность — от номера прихожанина, без генератора: бой обязан
 * повторяться один в один.
 */
export function flockBurst(index: number, night: number): { dx: number; dy: number } {
  // Золотой угол: соседние по номеру улетают в разные стороны.
  const angle = index * 2.399963;
  const spread = ((index * 7919) % 1000) / 1000;
  const distance = (5 + spread * (15 + 0.6 * night)) / 48;
  return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance };
}

/**
 * Во сколько раз режется скорость в этой точке. Пока только от тумана (§4) — и,
 * как в оригинале, не на всей клетке, а в полосе `slowZone`.
 */
function slowAt(board: Board, book: BuildingBook, column: number, y: number): number {
  // Под полем тумана нет.
  if (y > board.height - 0.5) return 1;
  const row = Math.min(board.height - 1, Math.max(0, Math.round(y)));
  const cell = board.cells[row * board.width + column];
  if (cell === undefined || cell.kind !== 'building') return 1;
  const zone = buildingSpec(book, cell.building).slowZone;
  if (zone !== undefined) {
    // Доля высоты клетки сверху: 0 — верхний край, 1 — нижний.
    const from = y - row + 0.5;
    if (from <= zone[0] || from >= zone[1]) return 1;
  }
  return 1 - statsFor(book, cell.building, cell.tier).slowFactor;
}

/** Чем цель ценнее для этой постройки: берётся самая ценная (как в оригинале). */
function targetValue(turret: Turret, hunter: Live): number {
  const dx = hunter.column - turret.position.x;
  const dy = hunter.y - turret.position.y;
  switch (turret.spec.targeting) {
    case 'nearest': {
      // Ближе к постройке — ценнее. Кого уже добивают летящие снаряды — почти
      // не трогаем; раненого, в которого ничего не летит, — вдвое охотнее.
      let value = 6 - (Math.abs(dx) + Math.abs(dy));
      if (hunter.incoming * turret.stats.damage >= hunter.hp) value *= 0.1;
      else if (hunter.incoming === 0 && hunter.hp < hunter.maxHp) value *= 2;
      return value;
    }
    case 'vertical':
      return 1 / (Math.abs(dy) + 1);
    case 'horizontal':
      // Ближе по ряду — ценнее; при равенстве — тот, кто ближе к воротам.
      return 1 / (Math.abs(dx) + 1) - hunter.y * 1e-6;
    case 'facing': {
      const ahead = dx === 0 || Math.sign(dx) === turret.side;
      return (ahead ? 67 : 1) / (Math.abs(dx) + 1);
    }
    default:
      // Ближайший к воротам: у ворот y меньше.
      return -hunter.y;
  }
}

function pickTarget(turret: Turret, inRange: readonly Live[]): Live {
  return inRange.reduce((best, hunter) =>
    targetValue(turret, hunter) > targetValue(turret, best) ? hunter : best,
  );
}

/**
 * Расчёт Рассвета целиком, до единой картинки.
 *
 * Охотники идут строго вверх по своему столбцу и проходят сквозь постройки —
 * поиска пути нет и не нужно (§4). Постройки стреляют сами, игрок спит.
 *
 * Случайности в бою пока нет ни одной, поэтому и сида здесь нет: тот же вход
 * даёт тот же лог. Сид появится, когда появится случайное поведение.
 */
export function simulateNight(
  state: NightState,
  wave: WaveConfig,
  options: SimulateOptions,
): NightResult {
  const { board } = state;
  const dt = options.tickMs / 1000;
  const limitMs = options.maxSeconds * 1000;

  const events: NightEvent[] = [];
  const turrets = collectTurrets(board, options.buildings, state.nests, options.turretRange);
  const live: Live[] = [];

  // Выходящие по часам и выходящие следом за чужой смертью — паства (§10).
  const pending = wave.spawns
    .filter((spawn) => spawn.afterDeathOf === undefined)
    .sort((a, b) => a.atSecond - b.atSecond || a.id.localeCompare(b.id));
  let nextSpawn = 0;

  const waitingFor = new Map<string, WaveSpawn[]>();
  for (const spawn of wave.spawns) {
    const trigger = spawn.afterDeathOf;
    if (trigger === undefined) continue;
    const queue = waitingFor.get(trigger);
    if (queue) queue.push(spawn);
    else waitingFor.set(trigger, [spawn]);
  }
  /**
   * Паства, чей проповедник уже пал: ждёт своей секунды. Выходит, как в
   * оригинале, из самого проповедника — с того места, где он погиб.
   */
  let armed: { spawn: WaveSpawn; readyAt: number; y: number }[] = [];

  const release = (spawn: WaveSpawn, y = board.height - 1 + (options.spawnDepth ?? 0)): void => {
    const hp = statsAt(enemySpec(options.enemies, spawn.kind), state.night).hp;
    live.push({
      id: spawn.id,
      kind: spawn.kind,
      column: spawn.column,
      boss: spawn.boss === true,
      maxHp: hp,
      y,
      hp,
      incoming: 0,
      pace: 1,
    });
    events.push({
      type: 'spawn',
      at,
      id: spawn.id,
      kind: spawn.kind,
      column: spawn.column,
      hp,
      ...(spawn.boss === true && { boss: true }),
      y,
    });
  };

  // Зона огня считается по полю, продлённому вниз на простреливаемые ряды:
  // туда достают лоза по своему столбцу и горгульи нижнего ряда.
  const shootDepth = options.shootDepth ?? 0;
  const reach: Board = { ...board, height: board.height + shootDepth };
  const lastRow = board.height - 1 + shootDepth;
  /** Ряд врага — настоящий, а не прижатый к полю: под полем он свой. */
  const rowOf = (hunter: Live): number => Math.max(0, Math.round(hunter.y));

  /** Свита погибшего встаёт в очередь; свита прорвавшегося не выйдет вовсе. */
  const resolveFollowers = (id: string, died: boolean, y: number): void => {
    const queue = waitingFor.get(id);
    if (queue === undefined) return;
    waitingFor.delete(id);
    if (!died) return;
    queue.forEach((spawn, index) => {
      const burst = flockBurst(index, state.night);
      // Разлёт уводит прихожанина в соседний столбец, только если он вылетел
      // дальше половины клетки вбок — как в оригинале, это редкость.
      const shift = Math.abs(burst.dx) > 0.5 ? Math.sign(burst.dx) : 0;
      const column = Math.min(board.width - 1, Math.max(0, spawn.column + shift));
      armed.push({
        spawn: { ...spawn, column },
        readyAt: at + spawn.atSecond * 1000,
        y: y + burst.dy,
      });
    });
  };

  let citadel: Citadel = state.citadel;
  let at = 0;
  let killed = 0;
  let bossesKilled = 0;
  let leaked = 0;
  let outcome: NightOutcome;

  const flights: Flight[] = [];

  /** Попадание: урон и — как в оригинале — отбрасывание от стрелка. */
  const hit = (target: Live, amount: number, from: Position): void => {
    target.hp -= amount;
    events.push({ type: 'hit', at, id: target.id, amount, hpLeft: Math.max(0, target.hp), from });
    const knockback = statsAt(enemySpec(options.enemies, target.kind), state.night).knockback;
    if (knockback > 0 && target.hp > 0) {
      const dx = target.column - from.x;
      const dy = target.y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 0) target.y += (knockback * dy) / distance;
    }
  };

  /** Убрать погибших: смерть, счёт, паства. */
  const sweepDead = (): void => {
    for (let i = live.length - 1; i >= 0; i--) {
      const hunter = live[i] as Live;
      if (hunter.hp > 0) continue;
      events.push({ type: 'kill', at, id: hunter.id, column: hunter.column, y: hunter.y });
      live.splice(i, 1);
      killed++;
      if (hunter.boss) bossesKilled++;
      resolveFollowers(hunter.id, true, hunter.y);
    }
  };

  /**
   * Долетевшие снаряды. Цель погибла, пока снаряд летел, — стрела и ядро
   * пропадают, а болт лозы бьёт следующего в своём столбце (как в оригинале).
   */
  const land = (): void => {
    for (let i = flights.length - 1; i >= 0; i--) {
      const flight = flights[i] as Flight;
      if (flight.arriveAt > at) continue;
      flights.splice(i, 1);
      let target = live.find((hunter) => hunter.id === flight.targetId);
      if (target !== undefined) target.incoming--;
      if (target === undefined && flight.turret.spec.targeting === 'vertical') {
        const { x, y } = flight.turret.position;
        target = live.find((hunter) => hunter.column === x && hunter.y < y === flight.up);
      }
      if (target !== undefined) hit(target, flight.damage, flight.turret.position);
    }
    sweepDead();
  };

  for (;;) {
    // 1. Выпускаем всех, чьё время подошло.
    while (nextSpawn < pending.length) {
      const spawn = pending[nextSpawn] as WaveSpawn;
      if (spawn.atSecond * 1000 > at) break;
      release(spawn);
      nextSpawn++;
    }
    for (const waiting of armed) {
      if (waiting.readyAt <= at) release(waiting.spawn, waiting.y);
    }
    armed = armed.filter((waiting) => waiting.readyAt > at);
    land();

    // 2. Ночь кончилась?
    if (isFallen(citadel)) {
      outcome = 'citadel-fell';
      break;
    }
    if (live.length === 0 && nextSpawn >= pending.length && armed.length === 0) {
      outcome = 'cleared';
      break;
    }
    if (at >= limitMs) {
      outcome = 'timeout';
      break;
    }

    // 3. Постройки стреляют.
    for (const turret of turrets) {
      if (turret.stats.shotsPerSecond <= 0) continue;
      const reload = 1 / turret.stats.shotsPerSecond;
      turret.cooldown -= dt;

      while (turret.cooldown <= 0) {
        const cells = coveredCells(reach, turret.position, turret.fire, turret.facing);
        const inRange = live.filter((hunter) => {
          const row = rowOf(hunter);
          return row <= lastRow && cells.some((cell) => cell.x === hunter.column && cell.y === row);
        });

        if (inRange.length === 0) {
          // Цели нет — перезарядка не тратится, постройка ждёт наготове.
          turret.cooldown = 0;
          break;
        }

        // «Одна цель» — самая ценная для этой постройки (`targetValue`). При
        // равенстве — тот, кто вышел раньше: порядок в списке живых уже
        // детерминирован, отдельный разбор ничьей ничего не добавил бы.
        const targets = turret.spec.targets === 'all' ? inRange : [pickTarget(turret, inRange)];

        events.push({
          type: 'shot',
          at,
          from: turret.position,
          targets: targets.map((hunter) => hunter.id),
          damage: turret.stats.damage,
        });
        const speed = options.projectileSpeed;
        for (const target of targets) {
          if (speed === undefined) {
            hit(target, turret.stats.damage, turret.position);
            continue;
          }
          // Снаряд летит: урон придёт, когда долетит (не раньше следующего тика).
          const distance = Math.hypot(
            target.column - turret.position.x,
            target.y - turret.position.y,
          );
          const flightMs = Math.max(options.tickMs, (distance / speed) * 1000);
          target.incoming++;
          flights.push({
            targetId: target.id,
            turret,
            damage: turret.stats.damage,
            arriveAt: at + flightMs,
            up: target.y < turret.position.y,
          });
        }
        sweepDead();

        turret.cooldown += reload;
      }
    }

    // 4. Охотники идут вверх.
    for (let i = live.length - 1; i >= 0; i--) {
      const hunter = live[i] as Live;
      const spec = statsAt(enemySpec(options.enemies, hunter.kind), state.night);
      const before = cellOf(hunter, board.height);
      const pace = slowAt(board, options.buildings, hunter.column, hunter.y);
      hunter.y -= spec.speed * pace * dt;
      // Координата — после шага, как у `move` и `leak`: сцена ведёт спрайт
      // линейно между ними, и снятая до шага давала на выходе из тумана рывок
      // вдвое быстрее шага (заметно между двумя завесами).
      if (pace !== hunter.pace) {
        hunter.pace = pace;
        events.push({ type: 'pace', at, id: hunter.id, y: hunter.y, factor: pace });
      }

      if (hunter.y < 0) {
        // Дошёл босс со свитой внутри — ворота получают и за него, и за всю
        // его паству, которая иначе вылетела бы из него и пошла на поле:
        // прорыв не должен быть выгоднее убийства.
        const carried = waitingFor.get(hunter.id) ?? [];
        const damage =
          spec.citadelDamage +
          carried.reduce(
            (sum, follower) =>
              sum + statsAt(enemySpec(options.enemies, follower.kind), state.night).citadelDamage,
            0,
          );
        citadel = damageCitadel(citadel, damage);
        leaked += 1 + carried.length;
        events.push({
          type: 'leak',
          at,
          id: hunter.id,
          column: hunter.column,
          damage,
          heartsLeft: citadel.hearts,
          y: hunter.y,
        });
        live.splice(i, 1);
        resolveFollowers(hunter.id, false, hunter.y);
        continue;
      }

      const after = cellOf(hunter, board.height);
      if (after !== before) {
        events.push({ type: 'move', at, id: hunter.id, from: before, to: after, y: hunter.y });
      }
    }

    at += options.tickMs;
  }

  events.push({ type: 'end', at, reason: outcome });

  const survivors: Hunter[] = live.map((hunter) => ({
    id: hunter.id,
    kind: hunter.kind,
    column: hunter.column,
    y: hunter.y,
    hp: hunter.hp,
  }));

  return { citadel, events, outcome, killed, bossesKilled, leaked, survivors, durationMs: at };
}
