import { describe, expect, it } from 'vitest';

import { BOSS_CONFIG } from '@/shared/config/bosses';

import { musicForNight } from './tension';
import type { TensionRule } from './tension';

const rule: TensionRule = { bossNights: BOSS_CONFIG.nights, tenseFromNight: 6 };

describe('музыка по напряжению', () => {
  it('первые ночи спокойные', () => {
    for (const night of [1, 2, 5]) {
      expect(musicForNight(night, rule), `ночь ${String(night)}`).toBe('calm');
    }
  });

  it('дальше идёт напряжённая', () => {
    for (const night of [6, 7, 9, 11]) {
      expect(musicForNight(night, rule), `ночь ${String(night)}`).toBe('tense');
    }
  });

  it('ночи проповедника — своя тема (§10)', () => {
    for (const night of BOSS_CONFIG.nights) {
      expect(musicForNight(night, rule), `ночь ${String(night)}`).toBe('boss');
    }
  });

  it('тема босса перебивает напряжённую', () => {
    expect(musicForNight(10, { bossNights: [10], tenseFromNight: 2 })).toBe('boss');
  });

  it('порог напряжённости — настройка, а не число в коде', () => {
    expect(musicForNight(3, { bossNights: [], tenseFromNight: 3 })).toBe('tense');
    expect(musicForNight(3, { bossNights: [], tenseFromNight: 9 })).toBe('calm');
  });
});
