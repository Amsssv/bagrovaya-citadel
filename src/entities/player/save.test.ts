import { describe, expect, it } from 'vitest';

import { EMPTY_SAVE, MIGRATIONS, SAVE_VERSION, loadSave, serializeSave } from './save';
import type { Migration, SaveData } from './save';

const filled: SaveData = {
  version: SAVE_VERSION,
  savedAt: 1_700_000_000_000,
  run: {
    level: 'crimson',
    night: 7,
    hearts: 21,
    maxHearts: 30,
    purse: { swaps: 14, initial: 25, spent: 23, granted: 12 },
    inventory: { 'cursed-ash': 2 },
    board: {
      width: 2,
      height: 2,
      cells: [
        { kind: 'tile', resource: 'stone' },
        { kind: 'building', building: 'gargoyle', tier: 'bone' },
        { kind: 'potion', tier: 'raw' },
        { kind: 'empty' },
      ],
    },
    rng: { seed: 42, state: -1234 },
    stats: {
      nights: 6,
      enemiesKilled: 11,
      bossesKilled: 0,
      enemiesLeaked: 3,
      merges: 4,
      crimsonMerges: 1,
      potionsOpened: 2,
      swapsSpent: 23,
      itemsUsed: 1,
      defense: { raw: 1, bone: 1, obsidian: 0, crimson: 0 },
    },
    repaired: false,
    dayOff: false,
    dayOffTaken: false,
    nests: {
      left: { cell: { kind: 'building', building: 'gargoyle', tier: 'bone' }, facing: 'down' },
    },
  },
  carried: { bats: 1 },
  best: { crimson: { score: 0, nights: 9 }, 'ash-crypt': { score: 120, nights: 3 } },
  settings: {
    speed: 2,
    quality: 'low',
    guideSeen: false,
    tutorialDone: true,
    tips: ['gargoyle'],
    confirmToss: true,
    sound: { music: 0.3, sfx: 0.5, muted: true },
  },
};

/** Сейв первой версии: цитаделей-уровней (§12) ещё не было. */
function v1(run: Record<string, unknown> | null): Record<string, unknown> {
  return {
    version: 1,
    run,
    carried: { bats: 1 },
    best: { score: 40, nights: 4 },
    settings: { speed: 1 },
  };
}

describe('подъём сейва второй версии', () => {
  const v2 = (hearts: number, maxHearts = 30) => ({
    ...filled,
    version: 2,
    run: { ...(filled.run as NonNullable<typeof filled.run>), hearts, maxHearts },
  });

  it('забег из версии с 30 сердцами урезается до пяти, потолок — 36', () => {
    const result = loadSave(v2(17));
    expect(result.recovered).toBe(false);
    expect(result.save.run?.hearts).toBe(5);
    expect(result.save.run?.maxHearts).toBe(36);
  });

  it('раненой цитадели сердца не прибавляются', () => {
    expect(loadSave(v2(2, 36)).save.run?.hearts).toBe(2);
  });

  it('без забега трогать нечего', () => {
    expect(loadSave({ ...v2(17), run: null }).save.run).toBeNull();
  });

  it('сердца без числа — забег не читается, берём дефолт', () => {
    const broken = { ...v2(17), run: { ...v2(17).run, hearts: 'много' } };
    expect(loadSave(broken).save.run?.hearts).toBe(0);
  });
});

describe('подъём сейва первой версии', () => {
  it('забег достаётся Багровой: других цитаделей тогда не было', () => {
    const { level: _level, ...oldRun } = filled.run as NonNullable<typeof filled.run>;
    const result = loadSave(v1(oldRun));

    expect(result.recovered).toBe(false);
    expect(result.save.run?.level).toBe('crimson');
  });

  it('рекорд переезжает в летопись Багровой', () => {
    const { level: _level, ...oldRun } = filled.run as NonNullable<typeof filled.run>;
    expect(loadSave(v1(oldRun)).save.best).toEqual({ crimson: { score: 40, nights: 4 } });
  });

  it('забега не было — и не появляется', () => {
    const result = loadSave(v1(null));
    expect(result.recovered).toBe(false);
    expect(result.save.run).toBeNull();
  });

  it('миграция сама сломалась — запуск не падает, а начинается с чистого листа', () => {
    const broken: Record<number, Migration> = {
      1: () => {
        throw new Error('битая миграция');
      },
    };
    const result = loadSave(v1(null), broken);
    expect(result).toEqual({ save: EMPTY_SAVE, recovered: true });
  });
});

describe('настройки внешности', () => {
  it('режим качества переживает перезагрузку', () => {
    expect(loadSave(serializeSave(filled)).save.settings.quality).toBe('low');
  });

  it('сейва без режима качества хватает: это внешность, а не прогресс', () => {
    // Миграции ради нового поля внешности не заводим — у него есть значение по
    // умолчанию, и старый сейв читается как есть.
    const { quality: _quality, ...settings } = filled.settings;
    const result = loadSave({ ...filled, settings });

    expect(result.recovered).toBe(false);
    expect(result.save.settings.quality).toBe('high');
  });

  it('отметка «справку видели» переживает перезагрузку', () => {
    const seen = { ...filled, settings: { ...filled.settings, guideSeen: true } };
    expect(loadSave(serializeSave(seen)).save.settings.guideSeen).toBe(true);
  });

  it('сейв без отметки о справке читается как есть: справку покажут один раз', () => {
    const { guideSeen: _guideSeen, ...settings } = filled.settings;
    const result = loadSave({ ...filled, settings });

    expect(result.recovered).toBe(false);
    expect(result.save.settings.guideSeen).toBe(false);
  });

  it('новый игрок справку ещё не видел', () => {
    expect(EMPTY_SAVE.settings.guideSeen).toBe(false);
  });

  it('чужой режим качества сейв не ломает, а откатывает на умолчание', () => {
    const result = loadSave({ ...filled, settings: { speed: 1, quality: 'ультра' } });
    expect(result.recovered).toBe(true);
  });
});

describe('сохранение и чтение', () => {
  it('прочитанное совпадает с записанным', () => {
    const result = loadSave(serializeSave(filled));
    expect(result.recovered).toBe(false);
    expect(result.save).toEqual(filled);
  });

  it('читает и объект, и строку', () => {
    expect(loadSave(filled).save).toEqual(filled);
    expect(loadSave(JSON.stringify(filled)).save).toEqual(filled);
  });

  it('версия пишется всегда', () => {
    expect(JSON.parse(serializeSave(EMPTY_SAVE)).version).toBe(SAVE_VERSION);
  });

  it('пустой сейв — забега нет, но структура полная', () => {
    expect(loadSave(serializeSave(EMPTY_SAVE)).save.run).toBeNull();
  });
});

describe('битый сейв не роняет запуск', () => {
  const broken: unknown[] = [
    null,
    undefined,
    '',
    'не json',
    '{ это не json',
    42,
    [],
    {},
    { version: SAVE_VERSION },
    {
      version: SAVE_VERSION,
      run: 'ерунда',
      carried: {},
      best: { score: 0, nights: 0 },
      settings: { speed: 1 },
    },
    { ...filled, settings: { speed: 5 } },
    { ...filled, run: { ...filled.run, hearts: -3 } },
    {
      ...filled,
      run: { ...filled.run, board: { width: 2, height: 2, cells: [{ kind: 'дракон' }] } },
    },
  ];

  for (const [index, raw] of broken.entries()) {
    it(`случай ${String(index)} даёт значения по умолчанию, а не исключение`, () => {
      const result = loadSave(raw);
      expect(result.recovered).toBe(true);
      expect(result.save).toEqual(EMPTY_SAVE);
    });
  }
});

describe('сейв более новой версии', () => {
  it('не читается, но помечен как чужой, а не битый', () => {
    const result = loadSave({ ...filled, version: SAVE_VERSION + 1 });
    expect(result.save).toEqual(EMPTY_SAVE);
    expect(result.recovered).toBe(true);
    expect(result.tooNew).toBe(true);
  });

  it('битый сейв своей версии чужим не считается', () => {
    expect(loadSave({ version: SAVE_VERSION }).tooNew).toBeUndefined();
  });
});

describe('миграции', () => {
  const zeroToOne: Migration = (data) => ({
    ...data,
    run: null,
    carried: {},
    best: { score: 0, nights: 7 },
    settings: { speed: 1 },
  });

  // Выдуманное звено перед боевой цепочкой: так видно, что шаги складываются
  // один за другим, а не применяется только последний.
  const chain = { 0: zeroToOne, ...MIGRATIONS };

  it('старый сейв поднимается по цепочке', () => {
    const old = { version: 0, ancientField: true };
    const result = loadSave(old, chain);
    expect(result.recovered).toBe(false);
    expect(result.save.best['crimson']?.nights).toBe(7);
    expect(result.save.version).toBe(SAVE_VERSION);
  });

  it('сейв без версии считается нулевым и тоже мигрирует', () => {
    expect(loadSave({ carried: {} }, chain).recovered).toBe(false);
  });

  it('нет миграции с этой версии — грузим дефолт, а не падаем', () => {
    expect(loadSave({ version: 0 }).recovered).toBe(true);
  });

  it('сейв текущей версии миграций не требует', () => {
    expect(loadSave(filled, {}).recovered).toBe(false);
  });

  it('боевая цепочка доводит первую версию до текущей', () => {
    expect(loadSave(v1(null)).save.version).toBe(SAVE_VERSION);
  });
});

describe('башни замка в сейве', () => {
  it('старый сейв без башен читается: башни пустые', () => {
    const old = JSON.parse(serializeSave(filled)) as { run: Record<string, unknown> };
    delete old.run['nests'];
    const loaded = loadSave(JSON.stringify(old));
    expect(loaded.recovered).toBe(false);
    expect(loaded.save.run?.nests).toEqual({});
  });
});

describe('новые настройки читаются из старого сейва', () => {
  it('без обучения и звука — значения по умолчанию', () => {
    const old = { ...EMPTY_SAVE, settings: { speed: 1, quality: 'high', guideSeen: true } };
    const { settings } = loadSave(JSON.stringify(old)).save;
    expect(settings.guideSeen).toBe(true);
    expect(settings.tutorialDone).toBe(false);
    expect(settings.sound).toEqual({ music: 0.45, sfx: 0.7, muted: false });
  });
});
