import { describe, expect, it } from 'vitest';

import { eighth, scoreFor } from './music';
import { MUSIC } from './sounds';

describe('партитура', () => {
  it('у каждой темы своя партитура, такты по восемь восьмых', () => {
    for (const id of MUSIC) {
      const score = scoreFor(id);
      expect(score.bars.length, id).toBeGreaterThan(0);
      for (const bar of score.bars) {
        expect(bar.melody).toHaveLength(8);
        expect(bar.chord.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('чем напряжённее ночь, тем быстрее', () => {
    expect(scoreFor('calm').bpm).toBeLessThan(scoreFor('tense').bpm);
    expect(scoreFor('tense').bpm).toBeLessThan(scoreFor('boss').bpm);
  });

  it('спокойная — без стука сердца и колокола, босс — с обоими', () => {
    expect(scoreFor('calm').heartbeat).toBe(0);
    expect(scoreFor('calm').bell).toBe(0);
    expect(scoreFor('boss').heartbeat).toBeGreaterThan(0);
    expect(scoreFor('boss').bell).toBeGreaterThan(0);
  });

  it('спокойная шкатулка играет через раз, напряжённая — каждую восьмую', () => {
    const rests = (id: 'calm' | 'tense') =>
      scoreFor(id)
        .bars.flatMap((bar) => bar.melody)
        .filter((note) => note === null).length;
    expect(rests('calm')).toBeGreaterThan(0);
    expect(rests('tense')).toBe(0);
  });

  it('всё в ре миноре с ля мажором: никаких нот вне лада', () => {
    // Ре гармонический минор: ре, ми, фа, соль, ля, си-бемоль, до, до-диез.
    const scale = new Set([2, 4, 5, 7, 9, 10, 0, 1]);
    for (const id of MUSIC) {
      for (const bar of scoreFor(id).bars) {
        for (const note of [...bar.chord, ...bar.melody]) {
          if (note === null) continue;
          expect(scale.has(note % 12), `${id}: ${String(note)}`).toBe(true);
        }
      }
    }
  });

  it('восьмая — половина доли', () => {
    expect(eighth({ ...scoreFor('calm'), bpm: 60 })).toBe(0.5);
  });
});
