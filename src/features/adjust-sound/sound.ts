/**
 * Громкость звука: музыка и эффекты по отдельности и общий выключатель.
 *
 * Выключатель не трогает сами ползунки: включили обратно — звук вернулся на
 * ту громкость, что была. Чистые функции, поэтому проверяются тестами.
 */
export interface SoundSettings {
  readonly music: number;
  readonly sfx: number;
  readonly muted: boolean;
}

export type SoundChannel = 'music' | 'sfx';

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** Сколько на самом деле звучит канал. */
export function effectiveVolume(settings: SoundSettings, channel: SoundChannel): number {
  return settings.muted ? 0 : clamp(settings[channel]);
}

/**
 * Двинули ползунок. Подняли громкость при выключенном звуке — звук
 * включается: игрок явно хочет его слышать.
 */
export function withVolume(
  settings: SoundSettings,
  channel: SoundChannel,
  value: number,
): SoundSettings {
  const volume = clamp(value);
  return { ...settings, [channel]: volume, muted: settings.muted && volume === 0 };
}

/**
 * Выключатель. Включение при обоих ползунках на нуле ничего бы не дало —
 * тогда возвращаем громкость по умолчанию.
 */
export function toggleMuted(settings: SoundSettings, fallback: SoundSettings): SoundSettings {
  if (settings.muted && settings.music === 0 && settings.sfx === 0) {
    return { music: fallback.music, sfx: fallback.sfx, muted: false };
  }
  return { ...settings, muted: !settings.muted };
}

/** Звука не слышно совсем — на кнопке перечёркнутый динамик. */
export function isSilent(settings: SoundSettings): boolean {
  return settings.muted || (settings.music === 0 && settings.sfx === 0);
}
