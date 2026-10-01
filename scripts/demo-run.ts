/**
 * Забег целиком: Сумерки → Рассвет → следующая ночь, пока стоит цитадель.
 *
 * Цифры — из `src/shared/config/balance.ts` (сняты с оригинала, 🎯). Бот здесь
 * простейший, поэтому смотреть надо на то, что цикл замыкается, а не на то,
 * сколько ночей продержалась оборона.
 *
 * Бот в Сумерках — самый простой: перебирает все допустимые свапы и берёт тот,
 * что даёт постройку или слияние. Настоящий бот для сверки баланса — шаг 7.
 */
import { canOpenPotion, createBoard } from '@/entities/board';
import type { Position } from '@/entities/board';
import { createCitadel, createNests } from '@/entities/citadel';
import { createInventory } from '@/entities/item';
import { createPurse } from '@/entities/player';
import { isRunOver, playInTwilight, runDawn, startRun } from '@/processes/night';
import type { PlayerMove, RunOptions, RunState } from '@/processes/night';
import { BOARD_CONFIG } from '@/shared/config/board';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import { NIGHT_CONFIG } from '@/shared/config/night';
import { createRng } from '@/shared/lib/rng';

import { nightWave } from '@/entities/wave';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { POTION_SWAPS } from '@/shared/config/economy';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { BATTLE_CONFIG, NIGHT_WAVE_PLAN } from '@/shared/config/waves';

import { render } from './render';

const MAX_NIGHTS = 40;
const MAX_MOVES_PER_NIGHT = 6;
/** Ниже этого запаса бот идёт вскрывать потир. */
const OPEN_POTION_BELOW = 10;

/** Все соседние пары клеток — кандидаты в свап. */
function swapCandidates(width: number, height: number): [Position, Position][] {
  const pairs: [Position, Position][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x + 1 < width)
        pairs.push([
          { x, y },
          { x: x + 1, y },
        ]);
      if (y + 1 < height)
        pairs.push([
          { x, y },
          { x, y: y + 1 },
        ]);
    }
  }
  return pairs;
}

/** Ход бота: вскрыть потир, если беден, иначе лучший созидательный свап. */
function chooseMove(state: RunState, options: RunOptions): PlayerMove | null {
  if (state.purse.swaps <= OPEN_POTION_BELOW) {
    for (let index = 0; index < state.board.cells.length; index++) {
      const at = {
        x: index % state.board.width,
        y: Math.floor(index / state.board.width),
      };
      if (canOpenPotion(state.board, at)) return { type: 'open', at };
    }
  }

  let best: { move: PlayerMove; score: number } | null = null;
  for (const [from, to] of swapCandidates(state.board.width, state.board.height)) {
    const move: PlayerMove = { type: 'swap', from, to };
    // Ход проигрывается на копии: домен неизменяемый, состояние не портится.
    const probe = playInTwilight(state, move, options);
    const score = probe.board.cells.filter((cell) => cell.kind !== 'tile').length;
    if (best === null || score > best.score) best = { move, score };
  }

  // Ходим всегда, даже если тройки не выходит: в этом и есть главное правило
  // §3 — свап засчитывается без матча, и переставить постройку тоже ход.
  return best?.move ?? null;
}

function main(): void {
  const seed = Number(process.argv[2] ?? 1);
  const rng = createRng(seed);
  const waveRng = rng.fork('wave');

  const board = createBoard(rng.fork('board'), {
    width: BOARD_CONFIG.width,
    height: BOARD_CONFIG.height,
    resources: BOARD_CONFIG.resources,
    withoutMatches: BOARD_CONFIG.startWithoutMatches,
  });

  const options: RunOptions = {
    rng: rng.fork('refill'),
    resources: BOARD_CONFIG.resources,
    cascadesEnabled: BOARD_CONFIG.cascadesEnabled,
    costs: ECONOMY_CONFIG.costs,
    potionSwaps: POTION_SWAPS,
    longMatchFrom: ECONOMY_CONFIG.longMatchFrom,
    longMerge: ECONOMY_CONFIG.longMerge,
    comboFrom: ECONOMY_CONFIG.comboFrom,
    swapsPerNight: ECONOMY_CONFIG.swapsPerNight,
    enemies: ENEMY_BOOK,
    buildings: BUILDING_BOOK,
    tickMs: NIGHT_CONFIG.tickMs,
    maxSeconds: NIGHT_CONFIG.maxSeconds,
    turretRange: CITADEL_CONFIG.turretRange,
    projectileSpeed: BATTLE_CONFIG.projectileSpeed,
    spawnDepth: BATTLE_CONFIG.spawnDepth,
    shootDepth: BATTLE_CONFIG.shootDepth,
    waveFor: (night) => nightWave(NIGHT_WAVE_PLAN, night, BOARD_CONFIG.width, waveRng),
  };

  let state: RunState = startRun({
    board,
    citadel: createCitadel(CITADEL_CONFIG.startHearts, CITADEL_CONFIG.maxHearts),
    purse: createPurse(ECONOMY_CONFIG.swapsPerNight),
    inventory: createInventory(),
    nests: createNests(CITADEL_CONFIG.nests),
  });

  console.log('');
  console.log('  Цифры — с оригинала (balance.ts, 🎯), механики местами свои.');
  console.log('  Бот здесь простейший: смотреть надо на то, что цикл замыкается,');
  console.log('  а не на число прожитых ночей.');
  console.log('');
  console.log(`  🦇 Забег, сид ${String(seed)}. Стартовое поле:`);
  console.log('');
  console.log(render(state.board));
  console.log('');
  console.log('   ночь │ ходов │ свапов │ волна │ убито │ прорв │ сердца');
  console.log('  ──────┼───────┼────────┼───────┼───────┼───────┼───────');

  while (!isRunOver(state) && state.night <= MAX_NIGHTS) {
    const swapsBefore = state.purse.swaps;
    let moves = 0;

    while (moves < MAX_MOVES_PER_NIGHT && state.purse.swaps > 0) {
      const move = chooseMove(state, options);
      if (move === null) break;
      state = playInTwilight(state, move, options);
      moves++;
    }

    const report = runDawn(state, options);
    state = report.after;

    const row = [
      String(report.night).padStart(6),
      String(moves).padStart(6),
      `${String(swapsBefore)}→${String(state.purse.swaps)}`.padStart(7),
      String(report.wave.spawns.length).padStart(6),
      String(report.dawn.killed).padStart(6),
      String(report.dawn.leaked).padStart(6),
      String(state.citadel.hearts).padStart(7),
    ];
    console.log(`  ${row.join(' │')}`);
  }

  console.log('  ──────┴───────┴────────┴───────┴───────┴───────┴───────');
  console.log('');
  console.log(render(state.board));
  console.log('');
  console.log(
    `  Прожито ночей: ${String(state.night - 1)}. ${isRunOver(state) ? 'Цитадель пала.' : 'Забег оборван по пределу демонстрации.'}`,
  );
  console.log(
    `  Свапы: начало ${String(state.purse.initial)}, выдано ${String(state.purse.granted)}, потрачено ${String(state.purse.spent)}, осталось ${String(state.purse.swaps)}.`,
  );
  const balanced =
    state.purse.swaps === state.purse.initial + state.purse.granted - state.purse.spent;
  console.log(`  Экономика сходится: ${balanced ? 'да' : 'НЕТ'}.`);
  console.log('');
}

main();
