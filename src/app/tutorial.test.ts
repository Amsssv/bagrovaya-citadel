import { describe, expect, it } from 'vitest';

import { TUTORIAL_BEATS } from '@/features/tutorial';
import type { RunState } from '@/processes/night';
import { runDawn, stepInTwilight } from '@/processes/night';

import { boot } from './persistence';
import { withTutorial } from './tutorialRun';

/**
 * Обучение целиком, на настоящем движке: каждый ход сценария проходит, даёт
 * ровно задуманное, кровь кончается на последнем шаге, а волна первого дня
 * вся гибнет. Упал тест — правила поменялись, и сценарий надо подобрать
 * заново (docs: features/tutorial/script.ts).
 */
const EXPECT: Readonly<Record<string, { groups: number; blood: number }>> = {
  stone: { groups: 1, blood: 4 },
  tower: { groups: 0, blood: 3 },
  thorn: { groups: 1, blood: 2 },
  blood: { groups: 1, blood: 1 },
  drink: { groups: 0, blood: 3 },
  move: { groups: 0, blood: 2 },
  ash: { groups: 1, blood: 2 },
  merge: { groups: 2, blood: 1 },
  fog: { groups: 1, blood: 1 },
  drop: { groups: 0, blood: 0 },
};

function play() {
  const session = withTutorial(boot({ fresh: true, seed: 1 }), true);
  let run: RunState = session.run;
  let beforeMove: RunState = run;
  const log: { id: string; groups: number; blood: number; run: RunState }[] = [];
  const zones: { id: string; frame: string; at: { x: number; y: number }; run: RunState }[] = [];
  for (const beat of TUTORIAL_BEATS) {
    if (beat.kind === 'undo') {
      // Отмена возвращает поле и кровь к ходу до «move».
      run = beforeMove;
      continue;
    }
    if (beat.kind === 'card' && beat.zone !== undefined)
      zones.push({ id: beat.id, frame: beat.frame, at: beat.zone, run });
    if (beat.kind !== 'move') continue;
    beforeMove = run;
    const { run: next, step } = stepInTwilight(run, beat.move, session.options);
    log.push({ id: beat.id, groups: step.groups, blood: next.purse.swaps, run: next });
    run = next;
  }
  return { session, run, log, zones };
}

describe('обучение: первая ночь по сценарию', () => {
  it('кровь на старте — обычная норма ночи', () => {
    expect(withTutorial(boot({ fresh: true, seed: 1 }), true).run.purse.swaps).toBe(5);
  });

  it('каждый ход даёт ровно задуманное: ни лишней тройки, ни каскада', () => {
    const { log } = play();
    expect(log.map(({ id, groups, blood }) => ({ id, groups, blood }))).toEqual(
      Object.entries(EXPECT).map(([id, want]) => ({ id, ...want })),
    );
  });

  it('первая горгулья уходит в левую башню замка', () => {
    const towered = play().log.find((entry) => entry.id === 'tower')?.run;
    expect(towered?.nests.occupied['left']?.cell).toEqual({
      kind: 'building',
      building: 'gargoyle',
      tier: 'raw',
    });
  });

  it('зона атаки на карточке — ровно той постройки, о которой карточка', () => {
    const { zones } = play();
    expect(zones.map((zone) => zone.id)).toEqual([
      'gargoyle',
      'towered',
      'vine',
      'mortar',
      'merged',
      'fogveil',
    ]);
    for (const { frame, at, run } of zones) {
      const cell =
        at.y < 0
          ? run.nests.occupied['left']?.cell
          : run.board.cells[at.y * run.board.width + at.x];
      expect(cell?.kind === 'building' ? `${cell.building}-${cell.tier}` : null).toBe(frame);
    }
  });

  it('после слияния стоит Костяная горгулья', () => {
    const merged = play().log.find((entry) => entry.id === 'merge')?.run;
    expect(
      merged?.board.cells.some(
        (cell) => cell.kind === 'building' && cell.building === 'gargoyle' && cell.tier === 'bone',
      ),
    ).toBe(true);
  });

  it('к рассвету на поле все четыре постройки', () => {
    const { run } = play();
    const kinds = new Set(
      run.board.cells.flatMap((cell) => (cell.kind === 'building' ? [cell.building] : [])),
    );
    expect([...kinds].sort()).toEqual(['fogveil', 'gargoyle', 'mortar', 'vine']);
  });

  it('первый день: волна обучения вся гибнет, сердца целы', () => {
    const { session, run } = play();
    const report = runDawn(run, session.options);
    expect(report.dawn.leaked).toBe(0);
    expect(report.dawn.killed).toBe(4);
    expect(report.after.citadel.hearts).toBe(run.citadel.hearts);
  });

  it('со второй ночи — обычные волны', () => {
    const session = withTutorial(boot({ fresh: true, seed: 1 }), true);
    expect(session.options.waveFor(2).spawns.length).toBeGreaterThan(0);
    expect(session.options.waveFor(2).spawns.some((spawn) => spawn.id.startsWith('tutorial'))).toBe(
      false,
    );
  });

  it('без обучения и для поднятого из сейва забега — ничего не меняется', () => {
    const plain = boot({ fresh: true, seed: 1 });
    expect(withTutorial(plain, false)).toBe(plain);
    expect(withTutorial({ ...plain, fresh: false }, true).run).toBe(plain.run);
  });
});
