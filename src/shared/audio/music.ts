import type { MusicId } from './sounds';

/**
 * Музыка — готика в ре миноре: орган, музыкальная шкатулка, колокол собора.
 * Три темы по напряжению ночи (`tension.ts`). Здесь только ноты — партитура
 * данными, её проверяют тесты; играет её подложка (`webAudio.ts`).
 *
 * Такт — 8 восьмых. Аккорды — MIDI-ноты органа; арпеджио шкатулки строится
 * из тех же нот на октаву-две выше.
 */
export interface Bar {
  /** Аккорд органа на весь такт. */
  readonly chord: readonly number[];
  /** Ноты шкатулки по восьмым; null — пауза. */
  readonly melody: readonly (number | null)[];
}

export interface Score {
  readonly bpm: number;
  readonly bars: readonly Bar[];
  /** Громкость органа. */
  readonly organ: number;
  readonly box: number;
  /** Стук сердца на первой доле, 0 — нет. */
  readonly heartbeat: number;
  /** Колокол на первой доле каждого второго такта, 0 — нет. */
  readonly bell: number;
  /** Низкое остинато по восьмым, 0 — нет. */
  readonly bowed: number;
}

/** Ре минор: i — VI — iv — V (ля мажор — гармонический минор, готика). */
const DM = [50, 53, 57];
const BB = [46, 50, 53];
const GM = [43, 46, 50];
const A = [45, 49, 52];
const F = [41, 45, 48];
const C = [48, 52, 55];

/** Арпеджио по нотам аккорда: вверх и назад, на две октавы выше. */
function arpeggio(chord: readonly number[], every = 1): (number | null)[] {
  const [a = 0, b = 0, c = 0] = chord;
  const run = [a, b, c, a + 12, c + 12, a + 12, c, b].map((note) => note + 12);
  return run.map((note, index) => (index % every === 0 ? note : null));
}

const SCORES: Readonly<Record<MusicId, Score>> = {
  // Ночь спокойная: орган долгими аккордами, шкатулка через раз.
  calm: {
    bpm: 66,
    bars: [DM, BB, GM, A, DM, F, C, A].map((chord) => ({ chord, melody: arpeggio(chord, 2) })),
    organ: 0.5,
    box: 0.1,
    heartbeat: 0,
    bell: 0,
    bowed: 0,
  },
  // Напряжённая: шкатулка каждой восьмой, стук сердца.
  tense: {
    bpm: 84,
    bars: [DM, BB, GM, A].map((chord) => ({ chord, melody: arpeggio(chord) })),
    organ: 0.45,
    box: 0.09,
    heartbeat: 0.32,
    bell: 0,
    bowed: 0.05,
  },
  // Ночь босса: колокол, низкое остинато, стук сердца.
  boss: {
    bpm: 96,
    bars: [DM, GM, A, DM, BB, GM, A, A].map((chord) => ({ chord, melody: arpeggio(chord) })),
    organ: 0.5,
    box: 0.08,
    heartbeat: 0.38,
    bell: 0.16,
    bowed: 0.08,
  },
};

export function scoreFor(id: MusicId): Score {
  return SCORES[id];
}

/** Длительность восьмой, секунд. */
export function eighth(score: Score): number {
  return 60 / score.bpm / 2;
}
