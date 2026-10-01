/**
 * Что игра умеет звучать.
 *
 * Звук ничего не сообщает сверх того, что уже на экране: большинство играет в
 * беззвучном режиме, и игра обязана быть полностью понятной без него. Поэтому
 * список короткий и весь про подтверждение действия, а не про информацию.
 */
export type SoundId = 'swap' | 'match' | 'merge' | 'potion' | 'shot' | 'kill' | 'leak' | 'blocked';

export const SOUNDS: readonly SoundId[] = [
  'swap',
  'match',
  'merge',
  'potion',
  'shot',
  'kill',
  'leak',
  'blocked',
];

/** Музыка по напряжению боя. */
export type MusicId = 'calm' | 'tense' | 'boss';

export const MUSIC: readonly MusicId[] = ['calm', 'tense', 'boss'];

export type Channel = 'sfx' | 'music';

export const CHANNELS: readonly Channel[] = ['sfx', 'music'];
