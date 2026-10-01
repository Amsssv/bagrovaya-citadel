/**
 * Расчёт ночи текстом — точка проверки шага 6.
 *
 * Цифры — из `src/shared/config/balance.ts`: горгулья подтверждена спекой (§6),
 * остальное снято с оригинала (🎯, docs/original-analysis.md).
 */
import { building, createBoard, withCells } from '@/entities/board';
import type { Position } from '@/entities/board';
import { createCitadel } from '@/entities/citadel';
import { simulateNight } from '@/entities/wave';
import type { NightEvent, WaveConfig } from '@/entities/wave';
import { BOARD_CONFIG } from '@/shared/config/board';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { NIGHT_CONFIG } from '@/shared/config/night';
import { createRng } from '@/shared/lib/rng';

import { nightWave } from '@/entities/wave';
import { BUILDING_BOOK } from '@/shared/config/buildings';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { NIGHT_WAVE_PLAN } from '@/shared/config/waves';

import { render } from './render';

function describe(event: NightEvent): string {
  switch (event.type) {
    case 'spawn':
      return `выходит ${event.id} (${event.kind}) в столбце ${String(event.column)}`;
    case 'move':
      return `${event.id}: ряд ${String(event.from)} → ${String(event.to)}`;
    case 'pace':
      return event.factor < 1
        ? `${event.id} в тумане: скорость ×${event.factor.toFixed(2)}`
        : `${event.id} вышел из тумана`;
    case 'shot':
      return `выстрел из (${String(event.from.x)},${String(event.from.y)}) → ${event.targets.join(', ')}, ${String(event.damage)} урона`;
    case 'hit':
      return `${event.id} получил ${String(event.amount)}, осталось ${String(event.hpLeft)}`;
    case 'kill':
      return `${event.id} убит`;
    case 'leak':
      return `${event.id} дошёл до ворот: −${String(event.damage)} сердец, осталось ${String(event.heartsLeft)}`;
    case 'end':
      return `ночь окончена (${event.reason})`;
  }
}

const MARK: Record<NightEvent['type'], string> = {
  spawn: '▸',
  move: ' ',
  pace: '~',
  shot: '✦',
  hit: '·',
  kill: '☠',
  leak: '⚑',
  end: '■',
};

function main(): void {
  const seed = Number(process.argv[2] ?? 1);
  const rng = createRng(seed);

  let board = createBoard(rng.fork('board'), {
    width: BOARD_CONFIG.width,
    height: BOARD_CONFIG.height,
    resources: BOARD_CONFIG.resources,
    withoutMatches: BOARD_CONFIG.startWithoutMatches,
  });

  // Расставляем оборону руками: свапы игрока — это шаг 10, а здесь нужен бой.
  const defence: [Position, ReturnType<typeof building>][] = [
    [{ x: 1, y: 2 }, building('gargoyle', 'bone')],
    [{ x: 3, y: 3 }, building('gargoyle', 'raw')],
    [{ x: 2, y: 4 }, building('fogveil', 'raw')],
    [{ x: 4, y: 2 }, building('mortar', 'raw')],
    [{ x: 0, y: 3 }, building('vine', 'raw')],
  ];
  board = withCells(board, defence);

  const night = Number(process.argv[3] ?? 1);
  const wave: WaveConfig = nightWave(NIGHT_WAVE_PLAN, night, board.width, rng.fork('wave'));

  const result = simulateNight(
    { board, citadel: createCitadel(CITADEL_CONFIG.startHearts, CITADEL_CONFIG.maxHearts), night },
    wave,
    {
      enemies: ENEMY_BOOK,
      buildings: BUILDING_BOOK,
      tickMs: NIGHT_CONFIG.tickMs,
      maxSeconds: NIGHT_CONFIG.maxSeconds,
    },
  );

  console.log('');
  console.log('  Цифры — из balance.ts: горгулья по §6, остальное снято с оригинала (🎯).');
  console.log('');
  console.log(
    `  🌙 Ночь ${String(night)}, сид ${String(seed)}. Поле ${String(board.width)}×${String(board.height)}:`,
  );
  console.log('');
  console.log(render(board));
  console.log('');
  console.log(`  Волна: ${String(wave.spawns.length)} охотников`);
  console.log('  ─────────────────────────────────────────────');

  for (const event of result.events) {
    if (event.type === 'hit') continue; // слишком мелко для глаза
    const seconds = (event.at / 1000).toFixed(2).padStart(6);
    console.log(`  ${seconds}с ${MARK[event.type]} ${describe(event)}`);
  }

  console.log('  ─────────────────────────────────────────────');
  console.log(
    `  Итог: ${result.outcome}. Убито ${String(result.killed)}, прорвалось ${String(result.leaked)}.`,
  );
  console.log(
    `  Сердца ${String(CITADEL_CONFIG.startHearts)} → ${String(result.citadel.hearts)}. Событий в логе: ${String(result.events.length)}.`,
  );
  console.log('');
}

main();
