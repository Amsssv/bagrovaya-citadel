import { useEffect, useRef } from 'react';

import type { PlayerMove, RunOptions, RunState } from '@/processes/night';
import { STRATEGIST, chooseStrategistMove } from '@/processes/night/strategist';
import type { Storage } from '@/shared/api';
import { createMemoryStorage } from '@/shared/api';
import { createRng } from '@/shared/lib/rng';

/**
 * Бот за игрока — посмотреть, как стратег (`processes/night/strategist.ts`)
 * играет вживую, в настоящей игре: те же ходы, анимации и бои.
 *
 * Только для dev-сервера: `?bot=1`, быстрее — `?bot=1&pace=150` (пауза между
 * ходами, мс). Обучение и подсказки пропускаются, карточки закрываются сами.
 * В сборке выключен: адрес App читает только под `import.meta.env.DEV`.
 */
export interface PilotConfig {
  /** Пауза между ходами, мс. */
  readonly pace: number;
}

export function pilotFromUrl(search: string): PilotConfig | null {
  const params = new URLSearchParams(search);
  if (params.get('bot') !== '1') return null;
  const pace = Number(params.get('pace') ?? 350);
  return { pace: Number.isFinite(pace) && pace >= 0 ? pace : 350 };
}

/** Бот включён адресом — только на dev-сервере. */
export const PILOT: PilotConfig | null =
  import.meta.env.DEV && typeof window !== 'undefined'
    ? pilotFromUrl(window.location.search)
    : null;

/**
 * Бот играет на своём сейве в памяти: настоящий сейв игрока он не трогает, а
 * после перезагрузки страницы начинает заново.
 */
export const PILOT_STORAGE: Storage | undefined =
  PILOT === null ? undefined : createMemoryStorage();

export interface PilotInput {
  readonly config: PilotConfig | null;
  readonly run: RunState;
  readonly options: RunOptions;
  readonly bossLane: number | null;
  /** Можно ходить: поле доиграло, не рассвет, забег идёт, окон нет. */
  readonly ready: boolean;
  readonly play: (move: PlayerMove) => void;
  /** Открытая карточка, которую пилот закроет сам, или null. */
  readonly dismiss: (() => void) | null;
}

export function useBotPilot({
  config,
  run,
  options,
  bossLane,
  ready,
  play,
  dismiss,
}: PilotInput): void {
  const rng = useRef(createRng(20260930));

  useEffect(() => {
    if (config === null || dismiss === null) return;
    const timer = setTimeout(dismiss, Math.max(900, config.pace * 3));
    return () => {
      clearTimeout(timer);
    };
  }, [config, dismiss]);

  useEffect(() => {
    if (config === null || !ready || dismiss !== null || run.purse.swaps <= 0) return;
    const timer = setTimeout(() => {
      const move = chooseStrategistMove(run, options, rng.current, STRATEGIST, bossLane);
      if (move !== null) play(move);
    }, config.pace);
    return () => {
      clearTimeout(timer);
    };
  }, [bossLane, config, dismiss, options, play, ready, run]);
}
