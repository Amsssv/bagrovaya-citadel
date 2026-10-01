import { createRng } from '@/shared/lib/rng';

import type { SoundId } from './sounds';

/**
 * Свой поток случайности для шума: к бою и полю он отношения не имеет, но
 * случайность в проекте — только из генератора с сидом.
 */
const grain = createRng(0x5eed);

/**
 * Звуки игры — синтез в Web Audio, без файлов: игра не тяжелеет, а чужих
 * записей с их лицензиями в сборке нет.
 *
 * Каждый звук собран под тему: камень, кровь, колокола собора. Все короткие —
 * звук подтверждает действие, а не рассказывает о нём.
 */
export interface SynthOut {
  readonly context: AudioContext;
  /** Сухой выход канала эффектов. */
  readonly dry: AudioNode;
  /** Посыл в реверберацию собора. */
  readonly wet: AudioNode;
  /** Белый шум секунды на две: из него режутся шорохи и хрусты. */
  readonly noise: AudioBuffer;
}

/** Частота ноты по MIDI: 69 — ля первой октавы. */
export function midiHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Шум на ~2 с — один на весь контекст. */
export function makeNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = grain.next() * 2 - 1;
  return buffer;
}

/**
 * Отклик собора для свёртки: шум, гаснущий по экспоненте, с тёмным хвостом.
 * Длиннее двух секунд — музыка тонет в эхе.
 */
export function makeHall(context: AudioContext, seconds = 2.4): AudioBuffer {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i++) {
      // Простой фильтр низких: хвост собора тёмный, без шипения.
      low += (grain.next() * 2 - 1 - low) * 0.35;
      data[i] = low * (1 - i / length) ** 2.6;
    }
  }
  return buffer;
}

/** Огибающая: быстрый подъём и экспоненциальный спад до тишины. */
function envelope(gain: GainNode, at: number, peak: number, attack: number, release: number): void {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
}

interface Tone {
  readonly hz: number;
  readonly to?: number;
  readonly wave: OscillatorType;
  readonly peak: number;
  readonly attack: number;
  readonly release: number;
  readonly delay?: number;
  /** Доля в реверберацию. */
  readonly wet?: number;
}

function tone(out: SynthOut, at: number, volume: number, spec: Tone): void {
  const { context } = out;
  const start = at + (spec.delay ?? 0);
  const osc = context.createOscillator();
  osc.type = spec.wave;
  osc.frequency.setValueAtTime(spec.hz, start);
  if (spec.to !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(spec.to, start + spec.attack + spec.release);
  }
  const gain = context.createGain();
  envelope(gain, start, spec.peak * volume, spec.attack, spec.release);
  osc.connect(gain);
  gain.connect(out.dry);
  if ((spec.wet ?? 0) > 0) {
    const send = context.createGain();
    send.gain.value = spec.wet ?? 0;
    gain.connect(send).connect(out.wet);
  }
  osc.start(start);
  osc.stop(start + spec.attack + spec.release + 0.05);
}

interface Hiss {
  readonly type: BiquadFilterType;
  readonly hz: number;
  readonly to?: number;
  readonly q?: number;
  readonly peak: number;
  readonly attack: number;
  readonly release: number;
  readonly delay?: number;
  readonly wet?: number;
}

function hiss(out: SynthOut, at: number, volume: number, spec: Hiss): void {
  const { context } = out;
  const start = at + (spec.delay ?? 0);
  const source = context.createBufferSource();
  source.buffer = out.noise;
  const filter = context.createBiquadFilter();
  filter.type = spec.type;
  filter.frequency.setValueAtTime(spec.hz, start);
  if (spec.to !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(spec.to, start + spec.attack + spec.release);
  }
  filter.Q.value = spec.q ?? 1;
  const gain = context.createGain();
  envelope(gain, start, spec.peak * volume, spec.attack, spec.release);
  source.connect(filter).connect(gain).connect(out.dry);
  if ((spec.wet ?? 0) > 0) {
    const send = context.createGain();
    send.gain.value = spec.wet ?? 0;
    gain.connect(send).connect(out.wet);
  }
  // Каждый раз — с нового места шума: одинаковые шорохи слышно.
  source.start(start, grain.next() * 1.5, spec.attack + spec.release + 0.05);
}

/** Колокол: неровные обертоны, как у литой бронзы. */
function bell(
  out: SynthOut,
  at: number,
  volume: number,
  hz: number,
  peak: number,
  release: number,
): void {
  for (const [ratio, level] of [
    [1, 1],
    [2.76, 0.45],
    [5.4, 0.22],
    [8.93, 0.1],
  ] as const) {
    tone(out, at, volume, {
      hz: hz * ratio,
      wave: 'sine',
      peak: peak * level,
      attack: 0.004,
      release: release / ratio ** 0.4,
      wet: 0.6,
    });
  }
}

/**
 * Гонг: мягкий удар колотушкой, гул нарастает и тянется секунды три. Обертоны
 * неровные, как у кованой бронзы, и каждый чуть «плывёт» по высоте — от этого
 * металлическое биение. Хвост уходит в эхо собора.
 */
function gong(out: SynthOut, at: number, volume: number): void {
  const { context } = out;
  const base = 58;
  for (const [ratio, level, swell, release, drift] of [
    [1, 0.5, 0.06, 3.2, 0.994],
    [1.52, 0.32, 0.12, 2.6, 1.004],
    [2.31, 0.24, 0.18, 2.2, 0.996],
    [3.19, 0.14, 0.22, 1.7, 1.006],
    [4.43, 0.08, 0.25, 1.2, 0.997],
  ] as const) {
    const start = at;
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base * ratio, start);
    osc.frequency.linearRampToValueAtTime(base * ratio * drift, start + release);
    const gain = context.createGain();
    // Верхние обертоны разгораются позже основного — гул «набухает».
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level * volume, start + swell);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + swell + release);
    osc.connect(gain);
    gain.connect(out.dry);
    const send = context.createGain();
    send.gain.value = 0.7;
    gain.connect(send).connect(out.wet);
    osc.start(start);
    osc.stop(start + swell + release + 0.05);
  }
  // Удар колотушки: глухой шлепок по металлу.
  hiss(out, at, volume, { type: 'lowpass', hz: 420, peak: 0.35, attack: 0.003, release: 0.12 });
  tone(out, at, volume, { hz: 90, to: 50, wave: 'sine', peak: 0.45, attack: 0.004, release: 0.35 });
}

/** Рецепты звуков. */
const RECIPES: Readonly<Record<SoundId, (out: SynthOut, at: number, volume: number) => void>> = {
  // Камень скребёт по камню.
  swap: (out, at, v) => {
    hiss(out, at, v, {
      type: 'bandpass',
      hz: 900,
      to: 500,
      q: 1.4,
      peak: 0.35,
      attack: 0.01,
      release: 0.12,
    });
    tone(out, at, v, { hz: 140, to: 110, wave: 'sine', peak: 0.18, attack: 0.005, release: 0.08 });
  },
  // Тройка: тёмный перезвон — квинта вниз, как у часовни.
  match: (out, at, v) => {
    bell(out, at, v, midiHz(74), 0.16, 0.9);
    bell(out, at + 0.07, v, midiHz(69), 0.12, 0.9);
  },
  // Слияние: восходящее мерцание и колокол сверху.
  merge: (out, at, v) => {
    for (const [i, note] of [62, 65, 69, 74].entries()) {
      tone(out, at, v, {
        hz: midiHz(note + 12),
        wave: 'triangle',
        peak: 0.12,
        attack: 0.01,
        release: 0.35,
        delay: i * 0.055,
        wet: 0.5,
      });
    }
    bell(out, at + 0.24, v, midiHz(86), 0.12, 1.2);
  },
  // Потир: глоток — два «булька» вниз и тёплый низ.
  potion: (out, at, v) => {
    tone(out, at, v, { hz: 420, to: 180, wave: 'sine', peak: 0.3, attack: 0.01, release: 0.12 });
    tone(out, at, v, {
      hz: 380,
      to: 150,
      wave: 'sine',
      peak: 0.26,
      attack: 0.01,
      release: 0.14,
      delay: 0.13,
    });
    hiss(out, at, v, { type: 'lowpass', hz: 700, peak: 0.12, attack: 0.02, release: 0.2 });
    bell(out, at + 0.3, v, midiHz(81), 0.07, 0.8);
  },
  // Выстрел: короткий свист воздуха.
  shot: (out, at, v) => {
    hiss(out, at, v, {
      type: 'bandpass',
      hz: 2600,
      to: 1200,
      q: 2,
      peak: 0.16,
      attack: 0.004,
      release: 0.07,
    });
  },
  // Гибель: хруст и глухой удар.
  kill: (out, at, v) => {
    hiss(out, at, v, { type: 'highpass', hz: 1500, peak: 0.2, attack: 0.002, release: 0.06 });
    tone(out, at, v, { hz: 120, to: 55, wave: 'sine', peak: 0.4, attack: 0.004, release: 0.18 });
  },
  // Враг у ворот: гонг цитадели — она ранена.
  leak: (out, at, v) => {
    gong(out, at, v);
  },
  // Нельзя: глухой деревянный стук.
  blocked: (out, at, v) => {
    tone(out, at, v, {
      hz: 190,
      to: 150,
      wave: 'triangle',
      peak: 0.3,
      attack: 0.003,
      release: 0.07,
    });
    hiss(out, at, v, { type: 'lowpass', hz: 600, peak: 0.12, attack: 0.002, release: 0.05 });
  },
};

/**
 * Не чаще, чем раз в столько секунд: гонг от пятерых, дошедших разом, — один
 * удар, а не гул, в котором ничего не разобрать.
 */
const MIN_GAP: Partial<Record<SoundId, number>> = { leak: 0.35 };
const lastPlayed = new WeakMap<AudioContext, Partial<Record<SoundId, number>>>();

export function playSound(out: SynthOut, id: SoundId, volume: number): void {
  const now = out.context.currentTime;
  const gap = MIN_GAP[id];
  if (gap !== undefined) {
    const played = lastPlayed.get(out.context) ?? {};
    const last = played[id];
    if (last !== undefined && now - last < gap) return;
    played[id] = now;
    lastPlayed.set(out.context, played);
  }
  RECIPES[id](out, now + 0.005, volume);
}

// ── инструменты музыки ───────────────────────────────────────────────────

/** Орган: две пилы с расстройкой и квадрат октавой ниже, мягкий фильтр. */
export function organ(
  out: SynthOut,
  at: number,
  notes: readonly number[],
  length: number,
  level: number,
): void {
  const { context } = out;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1100;
  filter.Q.value = 0.6;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.35);
  gain.gain.setValueAtTime(level, at + length - 0.3);
  gain.gain.linearRampToValueAtTime(0.0001, at + length + 0.25);
  filter.connect(gain);
  gain.connect(out.dry);
  const send = context.createGain();
  send.gain.value = 0.7;
  gain.connect(send).connect(out.wet);
  for (const note of notes) {
    for (const [wave, detune, octave] of [
      ['sawtooth', -6, 0],
      ['sawtooth', 6, 0],
      ['square', 0, -12],
    ] as const) {
      const osc = context.createOscillator();
      osc.type = wave;
      osc.frequency.value = midiHz(note + octave);
      osc.detune.value = detune;
      const voice = context.createGain();
      voice.gain.value = wave === 'square' ? 0.05 : 0.07;
      osc.connect(voice).connect(filter);
      osc.start(at);
      osc.stop(at + length + 0.35);
    }
  }
}

/** Музыкальная шкатулка: треугольник с быстрым спадом, в эхо. */
export function musicBox(out: SynthOut, at: number, note: number, level: number): void {
  tone(out, at, 1, {
    hz: midiHz(note),
    wave: 'triangle',
    peak: level,
    attack: 0.004,
    release: 0.9,
    wet: 0.55,
  });
  tone(out, at, 1, {
    hz: midiHz(note + 12),
    wave: 'sine',
    peak: level * 0.3,
    attack: 0.004,
    release: 0.4,
    wet: 0.55,
  });
}

/** Стук сердца: два глухих удара. */
export function heartbeat(out: SynthOut, at: number, level: number, gap: number): void {
  tone(out, at, 1, { hz: 62, to: 42, wave: 'sine', peak: level, attack: 0.006, release: 0.22 });
  tone(out, at + gap, 1, {
    hz: 58,
    to: 40,
    wave: 'sine',
    peak: level * 0.7,
    attack: 0.006,
    release: 0.2,
  });
}

/** Колокол собора для музыки. */
export function tollBell(out: SynthOut, at: number, note: number, level: number): void {
  bell(out, at, 1, midiHz(note), level, 3);
}

/** Низкая пила-остинато, как смычковые. */
export function bowed(
  out: SynthOut,
  at: number,
  note: number,
  length: number,
  level: number,
): void {
  const { context } = out;
  const osc = context.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = midiHz(note);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(filter).connect(gain).connect(out.dry);
  osc.start(at);
  osc.stop(at + length + 0.05);
}
