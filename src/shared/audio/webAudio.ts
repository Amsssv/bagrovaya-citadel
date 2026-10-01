import type { AudioBackend } from './manager';
import type { Score } from './music';
import { eighth, scoreFor } from './music';
import type { MusicId, SoundId } from './sounds';
import type { SynthOut } from './synth';
import {
  bowed,
  heartbeat,
  makeHall,
  makeNoise,
  musicBox,
  organ,
  playSound,
  tollBell,
} from './synth';

/**
 * Подложка на Web Audio.
 *
 * Контекст создаётся **в момент подъёма**, то есть внутри обработчика касания:
 * создать его раньше нельзя — браузер оставит его в состоянии suspended и будет
 * ругаться в консоль на каждом запуске.
 *
 * Звуки и музыка — синтез (`synth.ts`, `music.ts`), файлов нет. Музыку играет
 * секвенсор: раз в 25 мс он ставит в очередь ноты на ближайшие 150 мс по часам
 * контекста — таймеры браузера неточны, а часы звука точны.
 *
 * Схема: у эффектов и у музыки — своя реверберация собора, и **всё** — и
 * прямой звук, и эхо — проходит через шину громкости своего канала. Иначе эхо
 * шло бы в обход громкости, и выключенная музыка продолжала бы звучать им.
 */
const LOOKAHEAD_S = 0.15;
const TICK_MS = 25;
/** Смена темы: старая гаснет, новая поднимается. */
const FADE_S = 1.2;

interface Channels {
  readonly context: AudioContext;
  readonly sfx: SynthOut;
  /** Громкость музыки — последняя на пути и прямого звука, и эха. */
  readonly musicBus: GainNode;
  /** Эхо музыки: его выход возвращается в `musicBus`. */
  readonly musicHall: ConvolverNode;
  readonly noise: AudioBuffer;
}

interface Track {
  readonly score: Score;
  /** Своя шина трека: на смене темы гаснет только она. */
  readonly bus: GainNode;
  readonly out: SynthOut;
  step: number;
  nextAt: number;
}

export function createWebAudioBackend(): AudioBackend {
  let channels: Channels | null = null;
  let track: Track | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let musicVolume = 0;

  const schedule = (): void => {
    if (channels === null || track === null) return;
    const { context } = channels;
    const current = track;
    const step = eighth(current.score);
    while (current.nextAt < context.currentTime + LOOKAHEAD_S) {
      playStep(current, current.nextAt, step);
      current.nextAt += step;
      current.step += 1;
    }
  };

  const startTimer = (): void => {
    if (timer === null) timer = setInterval(schedule, TICK_MS);
  };

  return {
    unlock() {
      if (channels !== null) return;
      const Ctor = globalThis.AudioContext;
      if (Ctor === undefined) return;
      const context = new Ctor();
      const hallBuffer = makeHall(context);

      // Эффекты: громкость каждого звука задаётся при нём, эхо — общее.
      const sfxBus = context.createGain();
      sfxBus.connect(context.destination);
      const sfxHall = context.createConvolver();
      sfxHall.buffer = hallBuffer;
      const sfxHallOut = context.createGain();
      sfxHallOut.gain.value = 0.55;
      sfxHall.connect(sfxHallOut).connect(context.destination);

      // Музыка: и прямой звук, и эхо — через одну шину громкости.
      const musicBus = context.createGain();
      musicBus.gain.value = musicVolume;
      musicBus.connect(context.destination);
      const musicHall = context.createConvolver();
      musicHall.buffer = hallBuffer;
      const musicHallOut = context.createGain();
      musicHallOut.gain.value = 0.55;
      musicHall.connect(musicHallOut).connect(musicBus);

      const noise = makeNoise(context);
      channels = {
        context,
        sfx: { context, dry: sfxBus, wet: sfxHall, noise },
        musicBus,
        musicHall,
        noise,
      };
    },

    playOnce(id: SoundId, volume: number) {
      if (channels === null) return;
      playSound(channels.sfx, id, volume);
    },

    startLoop(id: MusicId, volume: number) {
      musicVolume = volume;
      if (channels === null) return;
      const { context, musicBus, musicHall, noise } = channels;
      musicBus.gain.setTargetAtTime(volume, context.currentTime, 0.1);
      fadeOut(track, context);

      const bus = context.createGain();
      bus.gain.setValueAtTime(0.0001, context.currentTime);
      bus.gain.linearRampToValueAtTime(1, context.currentTime + FADE_S);
      bus.connect(musicBus);
      // Посыл в эхо — тоже через шину трека: на смене темы гаснет и он.
      const wet = context.createGain();
      wet.gain.value = 0.9;
      bus.connect(wet).connect(musicHall);
      track = {
        score: scoreFor(id),
        bus,
        out: { context, dry: bus, wet, noise },
        step: 0,
        nextAt: context.currentTime + 0.1,
      };
      startTimer();
    },

    stopLoop() {
      if (channels !== null) fadeOut(track, channels.context);
      track = null;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },

    setLoopVolume(volume: number) {
      musicVolume = volume;
      if (channels === null) return;
      channels.musicBus.gain.setTargetAtTime(volume, channels.context.currentTime, 0.1);
    },

    suspend() {
      void channels?.context.suspend();
    },

    resume() {
      void channels?.context.resume();
      // Пока стояли, часы звука не шли — очередь просто продолжится.
    },
  };
}

function fadeOut(track: Track | null, context: AudioContext): void {
  if (track === null) return;
  const { bus } = track;
  bus.gain.cancelScheduledValues(context.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, context.currentTime);
  bus.gain.linearRampToValueAtTime(0.0001, context.currentTime + FADE_S);
  setTimeout(
    () => {
      bus.disconnect();
    },
    (FADE_S + 4) * 1000,
  );
}

/** Одна восьмая партитуры. */
function playStep(track: Track, at: number, step: number): void {
  const { score, out } = track;
  const bars = score.bars;
  const barIndex = Math.floor(track.step / 8) % bars.length;
  const inBar = track.step % 8;
  const bar = bars[barIndex];
  if (bar === undefined) return;

  if (inBar === 0) {
    organ(out, at, bar.chord, step * 8, score.organ * 0.3);
    if (score.heartbeat > 0) heartbeat(out, at, score.heartbeat, step * 0.6);
    if (score.bell > 0 && barIndex % 2 === 0)
      tollBell(out, at, (bar.chord[0] ?? 50) + 24, score.bell);
  }
  if (score.heartbeat > 0 && inBar === 4) heartbeat(out, at, score.heartbeat * 0.8, step * 0.6);

  const note = bar.melody[inBar];
  if (note !== null && note !== undefined) musicBox(out, at, note, score.box);
  if (score.bowed > 0) bowed(out, at, (bar.chord[0] ?? 50) - 12, step * 0.9, score.bowed);
}
