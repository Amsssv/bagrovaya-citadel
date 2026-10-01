/**
 * Подбор весов стратега.
 */
import { createNests } from '@/entities/citadel';
import type { RunOptions } from '@/processes/night';
import { freshRun, isRunOver, runDawn, stepInTwilight } from '@/processes/night';
import { STRATEGIST, chooseStrategistMove } from '@/processes/night/strategist';
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

/**
 * Подбор весов стратега: случайный спуск. Берёт лучшие веса, слегка меняет,
 * прогоняет те же сиды; стало дольше жить — оставляет.
 *
 * Запуск: npm run strategist:tune -- [сидов] [итераций]
 */
const [seeds = 8, iterations = 40] = process.argv.slice(2).map(Number);

type Weights = typeof STRATEGIST;

function play(seed: number, weights: Weights): number {
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
  while (!isRunOver(state) && state.night <= 50) {
    const lane =
      options.waveFor(state.night).spawns.find((spawn) => spawn.kind === 'preacher')?.column ??
      null;
    let moves = 0;
    while (state.purse.swaps > 0 && moves < 400) {
      const move = chooseStrategistMove(state, options, bot, weights, lane, 0);
      if (move === null) break;
      state = stepInTwilight(state, move, options).run;
      moves++;
    }
    state = runDawn(state, options).after;
  }
  return state.stats.nights;
}

function score(weights: Weights): number {
  let total = 0;
  for (let seed = 1; seed <= seeds; seed++) total += play(seed, weights);
  return total / seeds;
}

const tuner = createRng(4242);
function jitter(value: number): number {
  return Math.max(0, value * (0.6 + tuner.next() * 0.8));
}
function mutate(weights: Weights): Weights {
  const next: Record<string, unknown> = { ...weights };
  const keys = Object.keys(weights) as (keyof Weights)[];
  for (let i = 0; i < 3; i++) {
    const key = keys[tuner.int(0, keys.length)] as keyof Weights;
    const value = next[key];
    if (typeof value === 'number') next[key] = jitter(value);
    else
      next[key] = Object.fromEntries(
        Object.entries(value as Record<string, number>).map(([k, v]) => [k, jitter(v)]),
      );
  }
  return next as unknown as Weights;
}

let best: Weights = {
  ...STRATEGIST,
  ...(JSON.parse(process.env['W'] ?? '{}') as Partial<Weights>),
};
let bestScore = score(best);
console.log('старт', bestScore.toFixed(2), JSON.stringify(best));
for (let i = 1; i <= iterations; i++) {
  const candidate = mutate(best);
  const value = score(candidate);
  if (value > bestScore) {
    best = candidate;
    bestScore = value;
    console.log(`#${String(i)} лучше: ${value.toFixed(2)} ${JSON.stringify(best)}`);
  } else {
    console.log(`#${String(i)} ${value.toFixed(2)}`);
  }
}
console.log('итог', bestScore.toFixed(2), JSON.stringify(best));
