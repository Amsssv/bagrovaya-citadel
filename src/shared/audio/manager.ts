import type { Channel, MusicId, SoundId } from './sounds';

/**
 * Звук в одной точке входа.
 *
 * Вся политика — когда звучать, с какой громкостью, что делать при паузе —
 * живёт здесь и проверяется обычными тестами. Само извлечение звука вынесено в
 * подложку: Web Audio в браузере, заглушка в тестах.
 *
 * Два правила, от которых зависит, не будет ли игра ругаться в консоль:
 *
 *   — до первого касания экрана звука нет вовсе. Браузеры не дают запустить
 *     Web Audio без жеста пользователя, и попытка это сделать — не ошибка
 *     воспроизведения, а ошибка в консоли на каждом запуске;
 *   — пауза при уходе со вкладки возобновляется **без перезапуска** трека:
 *     музыка продолжается с того же места, а не начинается заново.
 */
export interface AudioBackend {
  /** Поднять звук. Зовётся только из обработчика жеста. */
  unlock(): void;
  playOnce(id: SoundId, volume: number): void;
  startLoop(id: MusicId, volume: number): void;
  stopLoop(): void;
  setLoopVolume(volume: number): void;
  suspend(): void;
  resume(): void;
}

export interface Audio {
  /** Первое касание экрана: до него игра звучать не имеет права. */
  unlock(): void;
  readonly ready: boolean;
  play(id: SoundId): void;
  /** null — тишина. Тот же трек второй раз не перезапускается. */
  music(id: MusicId | null): void;
  readonly playing: MusicId | null;
  setVolume(channel: Channel, value: number): void;
  volumeOf(channel: Channel): number;
  setPaused(paused: boolean): void;
  readonly paused: boolean;
}

export interface AudioVolumes {
  readonly sfx: number;
  readonly music: number;
}

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export function createAudio(backend: AudioBackend, volumes: AudioVolumes): Audio {
  const level: Record<Channel, number> = {
    sfx: clamp(volumes.sfx),
    music: clamp(volumes.music),
  };

  let ready = false;
  let paused = false;
  let playing: MusicId | null = null;
  /** Что просили включить до того, как звук подняли. */
  let wanted: MusicId | null = null;

  const startMusic = (id: MusicId): void => {
    backend.startLoop(id, level.music);
    playing = id;
  };

  return {
    unlock() {
      if (ready) return;
      backend.unlock();
      ready = true;
      if (wanted !== null && !paused) startMusic(wanted);
    },

    get ready() {
      return ready;
    },

    play(id) {
      if (!ready || paused || level.sfx === 0) return;
      backend.playOnce(id, level.sfx);
    },

    music(id) {
      wanted = id;
      if (!ready) return;

      if (id === null) {
        if (playing !== null) backend.stopLoop();
        playing = null;
        return;
      }
      // Тот же трек не перезапускаем: иначе возврат из фона обрывал бы музыку
      // на полуслове и начинал заново.
      if (id === playing) return;
      if (paused) return;
      startMusic(id);
    },

    get playing() {
      return playing;
    },

    setVolume(channel, value) {
      level[channel] = clamp(value);
      if (channel === 'music') backend.setLoopVolume(level.music);
    },

    volumeOf(channel) {
      return level[channel];
    },

    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (!ready) return;

      if (paused) {
        backend.suspend();
        return;
      }
      backend.resume();
      // Пока стояли на паузе, напряжение могло смениться — догоняем.
      if (wanted !== null && wanted !== playing) startMusic(wanted);
    },

    get paused() {
      return paused;
    },
  };
}
