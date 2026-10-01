import { TUTORIAL_REFILL_SEED, TUTORIAL_WAVE, tutorialBoard } from '@/features/tutorial';
import { createRng } from '@/shared/lib/rng';

import type { Boot } from './persistence';

/**
 * Забег обучения: поле, досыпка и волна первого дня — по сценарию
 * (`features/tutorial/script.ts`), чтобы первая ночь и первый день шли
 * ровно так, как написано. Со второй ночи — обычная игра.
 *
 * Только для нового забега: поднятый из сейва доигрывается как есть.
 */
export function withTutorial(session: Boot, tutorial: boolean): Boot {
  if (!tutorial || !session.fresh) return session;
  const refillRng = createRng(TUTORIAL_REFILL_SEED).fork('refill');
  const { waveFor } = session.options;
  return {
    ...session,
    run: { ...session.run, board: tutorialBoard() },
    refillRng,
    options: {
      ...session.options,
      rng: refillRng,
      waveFor: (night) => (night === 1 ? TUTORIAL_WAVE : waveFor(night)),
    },
  };
}
