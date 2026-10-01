import { describe, expect, it } from 'vitest';

import { boardFrom, pictureOf } from '@/entities/board/__testing__/boardFrom';
import { createCitadel, createNests } from '@/entities/citadel';
import { createInventory } from '@/entities/item';
import type { SaveData } from '@/entities/player';
import { EMPTY_STATS, createPurse, loadSave, serializeSave } from '@/entities/player';
import { createRng } from '@/shared/lib/rng';

import { freshRun, runToSave, saveToRun } from './persist';
import type { RunState } from './run';

const run: RunState = {
  board: boardFrom(`
    s t a
    G P f
    b s .
  `),
  citadel: createCitadel(21, 30),
  purse: createPurse(25),
  inventory: createInventory({ 'cursed-ash': 2 }),
  nests: createNests([]),
  night: 7,
  stats: { ...EMPTY_STATS, nights: 6, enemiesKilled: 11, merges: 3 },
};

describe('забег переживает перезагрузку', () => {
  it('сохранённое и прочитанное совпадает', () => {
    const rng = createRng(42).fork('refill');
    const save = runToSave(run, rng, 'hungry-night');
    const loaded = loadSave(serializeSave(save));

    expect(loaded.recovered).toBe(false);
    expect(loaded.save.run?.level).toBe('hungry-night');
    const back = saveToRun(loaded.save.run as NonNullable<typeof loaded.save.run>, createNests([]));

    expect(pictureOf(back.run.board)).toBe(pictureOf(run.board));
    expect(back.run.night).toBe(7);
    expect(back.run.citadel).toEqual(run.citadel);
    expect(back.run.purse).toEqual(run.purse);
    expect(back.run.inventory).toEqual(run.inventory);
    expect(back.run.stats).toEqual(run.stats);
  });

  it('выходной переживает перезагрузку, обычная ночь остаётся обычной', () => {
    const rest = saveToRun(
      runToSave({ ...run, dayOff: true, dayOffTaken: true }, createRng(1), 'crimson')
        .run as NonNullable<SaveData['run']>,
      createNests([]),
    );
    expect(rest.run.dayOff).toBe(true);
    expect(rest.run.dayOffTaken).toBe(true);
    const plain = saveToRun(
      runToSave(run, createRng(1), 'crimson').run as NonNullable<SaveData['run']>,
      createNests([]),
    );
    expect(plain.run.dayOff).toBeUndefined();
    expect(plain.run.dayOffTaken).toBeUndefined();
  });

  it('поток досыпки продолжается с того же места', () => {
    const rng = createRng(42).fork('refill');
    rng.next();
    rng.next();
    const expected = Array.from({ length: 5 }, () => rng.next());

    const save = runToSave(run, createRng(42).fork('refill'), 'crimson');
    // Снимок снят до тех двух бросков, поэтому восстановленный поток отдаёт их же.
    const back = saveToRun(save.run as NonNullable<typeof save.run>, createNests([]));
    back.rng.next();
    back.rng.next();
    expect(Array.from({ length: 5 }, () => back.rng.next())).toEqual(expected);
  });

  it('сохранение остаётся обычным JSON', () => {
    const save = runToSave(run, createRng(1).fork('refill'), 'crimson');
    expect(JSON.parse(serializeSave(save))).toEqual(save);
  });

  it('прежние поля сохранения не затираются', () => {
    const save = runToSave(run, createRng(1).fork('refill'), 'crimson', {
      version: 3,
      savedAt: 0,
      run: null,
      carried: { bats: 3 },
      best: { crimson: { score: 0, nights: 12 } },
      settings: {
        speed: 2,
        quality: 'high',
        guideSeen: false,
        tutorialDone: false,
        tips: [],
        confirmToss: true,
        sound: { music: 0.45, sfx: 0.7, muted: false },
      },
    });
    expect(save.carried).toEqual({ bats: 3 });
    expect(save.best['crimson']?.nights).toBe(12);
    expect(save.settings.speed).toBe(2);
  });
});

describe('новый забег', () => {
  const fresh = (carried: Record<string, number> = {}) =>
    freshRun({
      rng: createRng(5),
      width: 6,
      height: 6,
      resources: ['stone', 'thorn', 'ash', 'fog', 'blood'],
      withoutMatches: true,
      hearts: 30,
      maxHearts: 30,
      swaps: 25,
      nests: createNests([]),
      carried,
    });

  it('начинается с первой ночи и чистых счётчиков', () => {
    const state = fresh();
    expect(state.night).toBe(1);
    expect(state.stats).toEqual(EMPTY_STATS);
  });

  it('поле раздаётся по размеру из конфига', () => {
    expect(fresh().board.cells).toHaveLength(36);
  });

  it('предметы переносятся с прошлых забегов (§11)', () => {
    expect(fresh({ bats: 2 }).inventory.items).toEqual({ bats: 2 });
  });

  it('на одном сиде раздача одна и та же', () => {
    expect(pictureOf(fresh().board)).toBe(pictureOf(fresh().board));
  });
});

describe('башни замка переживают перезагрузку', () => {
  const slots = [
    { id: 'left', from: { x: 0, y: 0 }, direction: 'up' as const },
    { id: 'right', from: { x: 2, y: 0 }, direction: 'up' as const },
  ];
  const armed: RunState = {
    ...run,
    nests: {
      slots,
      occupied: {
        left: {
          cell: { kind: 'building', building: 'gargoyle', tier: 'obsidian' },
          facing: 'down',
        },
      },
    },
  };
  const reload = (config = slots) => {
    const loaded = loadSave(serializeSave(runToSave(armed, createRng(1), 'crimson')));
    if (loaded.save.run === null) throw new Error('забег не сохранился');
    return saveToRun(loaded.save.run, createNests(config)).run;
  };

  it('что стояло в башне, то и стоит', () => {
    expect(reload().nests.occupied).toEqual(armed.nests.occupied);
  });

  it('раскладка — из конфига: башня, которой в конфиге больше нет, отбрасывается', () => {
    const restored = reload([{ id: 'right', from: { x: 2, y: 0 }, direction: 'up' }]);
    expect(restored.nests.occupied).toEqual({});
    expect(restored.nests.slots.map((slot) => slot.id)).toEqual(['right']);
  });
});
