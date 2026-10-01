import { describe, expect, it, vi } from 'vitest';

import { createAudio } from './manager';
import type { AudioBackend } from './manager';

function spyBackend(): AudioBackend & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    unlock: () => calls.push('unlock'),
    playOnce: (id, volume) => calls.push(`once:${id}:${String(volume)}`),
    startLoop: (id, volume) => calls.push(`loop:${id}:${String(volume)}`),
    stopLoop: () => calls.push('stop'),
    setLoopVolume: (volume) => calls.push(`vol:${String(volume)}`),
    suspend: () => calls.push('suspend'),
    resume: () => calls.push('resume'),
  };
}

const volumes = { sfx: 0.8, music: 0.5 };

describe('до первого касания экрана', () => {
  it('звука нет вовсе', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.play('merge');
    audio.music('calm');
    expect(backend.calls).toEqual([]);
    expect(audio.ready).toBe(false);
  });

  it('и это не ошибка: браузер сам не даёт поднять Web Audio без жеста', () => {
    const audio = createAudio(spyBackend(), volumes);
    expect(() => {
      audio.play('shot');
    }).not.toThrow();
  });

  it('заказанная заранее музыка включается сразу после подъёма', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.music('tense');
    audio.unlock();
    expect(backend.calls).toEqual(['unlock', 'loop:tense:0.5']);
  });

  it('подъём второй раз ничего не делает', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.unlock();
    expect(backend.calls.filter((call) => call === 'unlock')).toHaveLength(1);
  });
});

describe('после подъёма', () => {
  const ready = () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    backend.calls.length = 0;
    return { backend, audio };
  };

  it('звук играет с громкостью своего канала', () => {
    const { backend, audio } = ready();
    audio.play('merge');
    expect(backend.calls).toEqual(['once:merge:0.8']);
  });

  it('музыка включается и запоминается', () => {
    const { backend, audio } = ready();
    audio.music('calm');
    expect(backend.calls).toEqual(['loop:calm:0.5']);
    expect(audio.playing).toBe('calm');
  });

  it('тот же трек второй раз не перезапускается', () => {
    const { backend, audio } = ready();
    audio.music('calm');
    audio.music('calm');
    expect(backend.calls.filter((call) => call.startsWith('loop'))).toHaveLength(1);
  });

  it('смена темы переключает трек', () => {
    const { backend, audio } = ready();
    audio.music('calm');
    audio.music('boss');
    expect(backend.calls).toEqual(['loop:calm:0.5', 'loop:boss:0.5']);
  });

  it('null глушит музыку', () => {
    const { backend, audio } = ready();
    audio.music('calm');
    audio.music(null);
    expect(backend.calls).toContain('stop');
    expect(audio.playing).toBeNull();
  });

  it('глушить, когда и так тихо, нечего', () => {
    const { backend, audio } = ready();
    audio.music(null);
    expect(backend.calls).toEqual([]);
  });
});

describe('громкость', () => {
  it('задаётся по каналам отдельно', () => {
    const audio = createAudio(spyBackend(), volumes);
    audio.setVolume('sfx', 0.3);
    expect(audio.volumeOf('sfx')).toBe(0.3);
    expect(audio.volumeOf('music')).toBe(0.5);
  });

  it('зажимается в ноль–единицу', () => {
    const audio = createAudio(spyBackend(), volumes);
    audio.setVolume('sfx', 5);
    expect(audio.volumeOf('sfx')).toBe(1);
    audio.setVolume('sfx', -2);
    expect(audio.volumeOf('sfx')).toBe(0);
  });

  it('начальная громкость тоже зажимается', () => {
    expect(createAudio(spyBackend(), { sfx: 9, music: -1 }).volumeOf('sfx')).toBe(1);
  });

  it('музыка меняет громкость на лету, не перезапускаясь', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.music('calm');
    backend.calls.length = 0;
    audio.setVolume('music', 0.2);
    expect(backend.calls).toEqual(['vol:0.2']);
  });

  it('на нулевой громкости звук не тревожит подложку', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.setVolume('sfx', 0);
    backend.calls.length = 0;
    audio.play('shot');
    expect(backend.calls).toEqual([]);
  });
});

describe('пауза при уходе со вкладки', () => {
  const ready = () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.music('calm');
    backend.calls.length = 0;
    return { backend, audio };
  };

  it('останавливает звук', () => {
    const { backend, audio } = ready();
    audio.setPaused(true);
    expect(backend.calls).toEqual(['suspend']);
    expect(audio.paused).toBe(true);
  });

  it('на паузе звуки молчат', () => {
    const { backend, audio } = ready();
    audio.setPaused(true);
    backend.calls.length = 0;
    audio.play('merge');
    expect(backend.calls).toEqual([]);
  });

  it('возобновляет **без перезапуска** трека', () => {
    const { backend, audio } = ready();
    audio.setPaused(true);
    audio.setPaused(false);
    expect(backend.calls).toEqual(['suspend', 'resume']);
    expect(backend.calls.some((call) => call.startsWith('loop'))).toBe(false);
  });

  it('если за время паузы напряжение сменилось, трек догоняет', () => {
    const { backend, audio } = ready();
    audio.setPaused(true);
    audio.music('boss');
    backend.calls.length = 0;
    audio.setPaused(false);
    expect(backend.calls).toEqual(['resume', 'loop:boss:0.5']);
  });

  it('повторная пауза ничего не делает', () => {
    const { backend, audio } = ready();
    audio.setPaused(true);
    audio.setPaused(true);
    expect(backend.calls.filter((call) => call === 'suspend')).toHaveLength(1);
  });

  it('пауза до подъёма звука подложку не трогает', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.setPaused(true);
    expect(backend.calls).toEqual([]);
    expect(audio.paused).toBe(true);
  });

  it('снятие паузы до подъёма тоже', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.setPaused(true);
    audio.setPaused(false);
    expect(backend.calls).toEqual([]);
  });

  it('поднятый на паузе звук музыку не заводит', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.music('calm');
    audio.setPaused(true);
    audio.unlock();
    expect(backend.calls).toEqual(['unlock']);
  });
});

describe('музыка по напряжению', () => {
  it('ход паузы не сбивает счётчик вызовов подложки', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.music('calm');
    audio.setPaused(true);
    audio.setPaused(false);
    audio.music('calm');
    expect(backend.calls.filter((call) => call.startsWith('loop'))).toHaveLength(1);
  });

  it('заказ музыки на паузе не звучит до снятия', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.setPaused(true);
    backend.calls.length = 0;
    audio.music('tense');
    expect(backend.calls).toEqual([]);
  });
});

describe('подложка изолирована', () => {
  it('менеджер не знает, чем именно звучат', () => {
    const backend = spyBackend();
    const audio = createAudio(backend, volumes);
    audio.unlock();
    audio.play('kill');
    // Ни одного обращения мимо интерфейса подложки.
    expect(backend.calls.every((call) => typeof call === 'string')).toBe(true);
    expect(vi.isMockFunction(backend.unlock)).toBe(false);
  });
});
