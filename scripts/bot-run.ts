/**
 * Массовый прогон ботом — шаг 7.
 *
 * Цифры сняты с оригинала (🎯 в `src/shared/config/balance.ts`,
 * docs/original-analysis.md), но часть механик у нас другая или ещё не сделана —
 * прежде всего башни замка, которыми в оригинале и убивают босса. Поэтому
 * числа ниже говорят о нашей игре, а не об оригинале один в один.
 *
 * Меры — из §13: разброс очков между умелым игроком и новичком примерно
 * **в двадцать пять раз**, потолок сильного игрока — около 5000.
 *
 * Запуск: npm run bot -- [забегов] [предел ночей]
 */
import { createNests } from '@/entities/citadel';
import type { BotProfile, BotRunResult, RunOptions } from '@/processes/night';
import { ADEPT, NOVICE, freshRun, playRun } from '@/processes/night';
import { BOARD_CONFIG } from '@/shared/config/board';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import { NIGHT_CONFIG } from '@/shared/config/night';
import { SCORE_CONFIG } from '@/shared/config/score';
import { createRng } from '@/shared/lib/rng';

import { nightWave } from '@/entities/wave';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { POTION_SWAPS } from '@/shared/config/economy';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { BATTLE_CONFIG, NIGHT_WAVE_PLAN } from '@/shared/config/waves';

function optionsFor(seed: number): RunOptions {
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
    waveFor: (night: number) => nightWave(NIGHT_WAVE_PLAN, night, BOARD_CONFIG.width, waveRng),
  };
}

function runOnce(seed: number, profile: BotProfile, maxNights: number): BotRunResult {
  const rng = createRng(seed);
  return playRun({
    run: freshRun({
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
    }),
    options: optionsFor(seed),
    profile,
    rng: rng.fork('bot'),
    weights: SCORE_CONFIG.weights,
    maxNights,
  });
}

interface Summary {
  readonly profile: BotProfile;
  readonly nights: number[];
  readonly scores: number[];
  readonly bosses: number[];
  readonly battleMs: number[];
  readonly capped: number;
}

function summarise(profile: BotProfile, runs: number, maxNights: number): Summary {
  const nights: number[] = [];
  const scores: number[] = [];
  const bosses: number[] = [];
  const battleMs: number[] = [];
  let capped = 0;

  for (let seed = 1; seed <= runs; seed++) {
    const result = runOnce(seed, profile, maxNights);
    nights.push(result.nights);
    scores.push(result.score);
    bosses.push(result.stats.bossesKilled);
    battleMs.push(result.battleMs / Math.max(1, result.nights));
    if (result.outcome === 'capped') capped++;
  }

  return { profile, nights, scores, bosses, battleMs, capped };
}

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

const mean = (values: readonly number[]): number => sum(values) / Math.max(1, values.length);

function quantile(values: readonly number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
}

/** Распределение ночей столбиками: видно форму, а не только среднее. */
function histogram(values: readonly number[]): string {
  const max = Math.max(...values);
  const counts = new Array<number>(max + 1).fill(0);
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  const peak = Math.max(...counts);

  return counts
    .map((count, night) => {
      if (count === 0) return null;
      const bar = '▇'.repeat(Math.max(1, Math.round((count / peak) * 28)));
      return `   ${String(night).padStart(3)} │ ${bar} ${String(count)}`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

function report(summary: Summary): void {
  const { profile } = summary;
  console.log('');
  console.log(`  ── ${profile.name} ──`);
  console.log(
    `  ночей: среднее ${mean(summary.nights).toFixed(1)}` +
      ` · медиана ${String(quantile(summary.nights, 0.5))}` +
      ` · 90-й ${String(quantile(summary.nights, 0.9))}` +
      ` · максимум ${String(Math.max(...summary.nights))}`,
  );
  console.log(
    `  очков: среднее ${mean(summary.scores).toFixed(0)}` +
      ` · медиана ${String(quantile(summary.scores, 0.5))}` +
      ` · 90-й ${String(quantile(summary.scores, 0.9))}`,
  );
  console.log(`  бой: в среднем ${(mean(summary.battleMs) / 1000).toFixed(1)} с за ночь`);
  console.log(`  дошли до предела ночей: ${String(summary.capped)}`);
  console.log('  распределение ночей:');
  console.log(histogram(summary.nights));
}

function main(): void {
  const runs = Number(process.argv[2] ?? 1000);
  const maxNights = Number(process.argv[3] ?? 60);

  console.log('');
  console.log('  Цифры — с оригинала (balance.ts, 🎯). Механики отличаются, прежде');
  console.log('  всего нет башен замка, которыми в оригинале убивают босса.');
  console.log('');
  console.log(
    `  🦇 Прогон: ${String(runs)} забегов на профиль, предел ${String(maxNights)} ночей.`,
  );

  const started = Date.now();
  const novice = summarise(NOVICE, runs, maxNights);
  const adept = summarise(ADEPT, runs, maxNights);

  report(novice);
  report(adept);

  const spread = mean(adept.scores) / Math.max(1, mean(novice.scores));
  const target = SCORE_CONFIG.checks.spreadAgainstNovice;

  console.log('');
  console.log('  ─────────────────────────────────────────────────────');
  console.log(`  Разброс умелый/новичок: ×${spread.toFixed(1)} (в оригинале ×${String(target)})`);
  console.log(
    `  Потолок очков у умелого: ${String(Math.max(...adept.scores))}` +
      ` (в оригинале около ${String(SCORE_CONFIG.checks.strongPlayerCeiling)})`,
  );
  console.log('');
  console.log(
    `  Побеждённых боссов у умелого: ${String(sum(adept.bosses))} за ${String(runs)} забегов.`,
  );
  console.log(`  Прогон занял ${((Date.now() - started) / 1000).toFixed(1)} с.`);
  console.log('');
}

main();
