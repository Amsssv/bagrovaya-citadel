import { describe, expect, it } from 'vitest';

import { effectiveVolume, isSilent, toggleMuted, withVolume } from './sound';

const DEFAULT = { music: 0.45, sfx: 0.7, muted: false };

describe('громкость', () => {
  it('выключенный звук молчит, но ползунки помнит', () => {
    const muted = { ...DEFAULT, muted: true };
    expect(effectiveVolume(muted, 'music')).toBe(0);
    expect(effectiveVolume(toggleMuted(muted, DEFAULT), 'music')).toBe(0.45);
  });

  it('громкость — от 0 до 1', () => {
    expect(effectiveVolume(withVolume(DEFAULT, 'sfx', 3), 'sfx')).toBe(1);
    expect(effectiveVolume(withVolume(DEFAULT, 'sfx', -1), 'sfx')).toBe(0);
  });

  it('подняли ползунок при выключенном звуке — звук включился', () => {
    const next = withVolume({ ...DEFAULT, muted: true }, 'music', 0.3);
    expect(next.muted).toBe(false);
    expect(effectiveVolume(next, 'music')).toBe(0.3);
  });

  it('ползунок в ноль при выключенном звуке звук не включает', () => {
    expect(withVolume({ ...DEFAULT, muted: true }, 'music', 0).muted).toBe(true);
  });

  it('включение при нулевых ползунках возвращает громкость по умолчанию', () => {
    const silent = { music: 0, sfx: 0, muted: true };
    expect(toggleMuted(silent, DEFAULT)).toEqual(DEFAULT);
  });

  it('тишина — выключен или оба ползунка на нуле', () => {
    expect(isSilent(DEFAULT)).toBe(false);
    expect(isSilent({ ...DEFAULT, muted: true })).toBe(true);
    expect(isSilent({ music: 0, sfx: 0, muted: false })).toBe(true);
  });
});
