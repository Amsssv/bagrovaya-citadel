import { z } from 'zod';

import raw from './audio.json';

/**
 * Звук: громкость по умолчанию и с какой ночи бой считается напряжённым.
 * Сами звуки и музыка синтезируются (`shared/audio/synth.ts`, `music.ts`).
 *
 * TODO_VERIFY: `tenseFromNight` — с какой ночи бой считается напряжённым, спека
 * не говорит.
 */
const AudioConfigSchema = z.object({
  volumes: z.object({
    sfx: z.number().min(0).max(1),
    music: z.number().min(0).max(1),
  }),
  tenseFromNight: z.int().positive(),
});

export const AUDIO_CONFIG = AudioConfigSchema.parse(raw);
