/**
 * Прогон стратега (`processes/night/strategist.ts`): как далеко он заходит.
 *
 * Запуск: npm run strategist -- [забегов] [предел ночей] [подробно]
 */
import { createNests } from '@/entities/citadel';
import type { RunOptions, RunState } from '@/processes/night';
import { freshRun, isRunOver, runDawn, stepInTwilight } from '@/processes/night';
import {
  STRATEGIST,
  candidateMoves,
  chooseStrategistMove,
  columnDefense,
  evaluate,
} from '@/processes/night/strategist';
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

const waves = new Map<number, ReturnType<RunOptions['waveFor']>>();
function optionsFor(seed: number): RunOptions {
  waves.clear();
  const rng = createRng(seed);
  const waveRng = rng.fork('wave');
  return {
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
    // Волна ночи считается один раз: бот спрашивает столбец босса заранее.
    waveFor: (night: number) => {
      const known = waves.get(night);
      if (known !== undefined) return known;
      const wave = nightWave(NIGHT_WAVE_PLAN, night, BOARD_CONFIG.width, waveRng);
      waves.set(night, wave);
      return wave;
    },
  };
}

const [runs = 3, maxNights = 50, verbose = 0] = process.argv.slice(2).map(Number);
const WEIGHTS = {
  ...STRATEGIST,
  ...(JSON.parse(process.env['W'] ?? '{}') as Partial<typeof STRATEGIST>),
};

function tally(state: RunState): string {
  const count: Record<string, number> = {};
  for (const cell of state.board.cells) {
    if (cell.kind === 'building')
      count[`${cell.building[0] ?? ''}${cell.tier[0] ?? ''}`] =
        (count[`${cell.building[0] ?? ''}${cell.tier[0] ?? ''}`] ?? 0) + 1;
    if (cell.kind === 'potion')
      count[`P${cell.tier[0] ?? ''}`] = (count[`P${cell.tier[0] ?? ''}`] ?? 0) + 1;
  }
  return Object.entries(count)
    .sort()
    .map(([k, v]) => `${k}${String(v)}`)
    .join(' ');
}

const started = Date.now();
const reached: number[] = [];
for (let seed = 1; seed <= runs; seed++) {
  const options = optionsFor(seed);
  const rng = createRng(seed);
  const bot = rng.fork('bot');
  let state = freshRun({
    rng,
    width: BOARD_CONFIG.width,
    height: BOARD_CONFIG.height,
    resources: BOARD_CONFIG.resources,
    withoutMatches: BOARD_CONFIG.startWithoutMatches,
    hearts: CITADEL_CONFIG.startHearts,
    maxHearts: CITADEL_CONFIG.maxHearts,
    swaps: ECONOMY_CONFIG.swapsPerNight,
    nests: createNests(CITADEL_CONFIG.nests),
    carried: {},
  });
  while (!isRunOver(state) && state.night <= maxNights) {
    let moves = 0;
    const lane =
      options.waveFor(state.night).spawns.find((spawn) => spawn.kind === 'preacher')?.column ??
      null;
    while (state.purse.swaps > 0 && moves < 400) {
      if (verbose > 2 && state.night === 3 && moves === 0) {
        for (const c of candidateMoves(state, options)) {
          const r = stepInTwilight(state, c, { ...options, rng: createRng(5) });
          if (r.step.groups > 0)
            console.log(
              '   cand',
              JSON.stringify(c),
              r.step.groups,
              evaluate(r.run, options).toFixed(2),
            );
        }
        console.log('   base', evaluate(state, options).toFixed(2));
      }
      const move = chooseStrategistMove(
        state,
        options,
        bot,
        WEIGHTS,
        lane,
        Number(process.env['BEAM'] ?? 0),
      );
      if (move === null) break;
      const stepped = stepInTwilight(state, move, options);
      if (verbose > 2)
        console.log(
          '    ',
          JSON.stringify(move),
          'групп',
          stepped.step.groups,
          'кровь',
          stepped.run.purse.swaps,
        );
      state = stepped.run;
      moves++;
    }
    if (verbose > 1) {
      const C: Record<string, string> = { stone: 's', thorn: 't', ash: 'a', fog: 'f', blood: 'b' };
      for (let y = 0; y < state.board.height; y++) {
        console.log(
          '      ' +
            state.board.cells
              .slice(y * 6, y * 6 + 6)
              .map((c) =>
                c.kind === 'tile'
                  ? C[c.resource] + '  '
                  : c.kind === 'building'
                    ? c.building[0]!.toUpperCase() + c.tier[0] + ' '
                    : c.kind === 'potion'
                      ? 'P' + c.tier[0] + ' '
                      : '.  ',
              )
              .join(''),
        );
      }
    }
    const report = runDawn(state, options);
    if (verbose > 0) {
      const cols = columnDefense(state, options)
        .map((v) => Math.round(v))
        .join('/');
      console.log(
        `  ночь ${String(state.night).padStart(2)}: ходов ${String(moves).padStart(3)} · прорвалось ${String(report.dawn.leaked)} · сердец ${String(report.after.citadel.hearts)} · столбцы ${cols} · ${tally(state)}`,
      );
    }
    state = report.after;
  }
  reached.push(state.stats.nights);
  console.log(
    `забег ${String(seed)}: ночей ${String(state.stats.nights)}, боссов ${String(state.stats.bossesKilled)}${isRunOver(state) ? '' : ' (дошёл до предела)'}`,
  );
}
console.log(
  `среднее ${String(reached.reduce((a, b) => a + b, 0) / reached.length)} · ${String(((Date.now() - started) / 1000).toFixed(1))} с`,
);
