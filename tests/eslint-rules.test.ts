import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Правила архитектуры имеют смысл, только если они действительно срабатывают.
 * Тихо сломать их очень легко: достаточно, чтобы резолвер перестал разбирать
 * импорт — и boundaries молча пропустит всё, посчитав модуль неизвестным.
 * Именно так правило слоёв и не работало, пока не подключили резолвер.
 *
 * Поэтому в src лежат намеренно сломанные фикстуры, скрытые от обычного
 * прогона линтера, а этот тест линтует их принудительно и сверяет, какие
 * правила сработали.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

type FixtureRules = Map<string, string[]>;

let fixtures: FixtureRules;

beforeAll(async () => {
  const eslint = new ESLint({ cwd: ROOT, ignore: false });
  const results = await eslint.lintFiles(['src/**/__fixtures__/**/*.ts']);

  fixtures = new Map(
    results.map((result) => [
      result.filePath.slice(ROOT.length),
      result.messages.map((message) => message.ruleId ?? 'parse-error').sort(),
    ]),
  );
}, 120_000);

/** Правила, сработавшие на фикстуре. Отсутствие файла — тоже провал теста. */
function rulesFor(fixture: string): string[] {
  const key = [...fixtures.keys()].find((path) => path.endsWith(fixture));
  expect(key, `фикстура ${fixture} не попала в прогон линтера`).toBeDefined();
  return fixtures.get(key as string) as string[];
}

describe('линтер ловит грязь в домене', () => {
  it('запрещает React, Phaser, zustand и интерфейс', () => {
    const rules = rulesFor('entities/board/__fixtures__/domain-purity.ts');
    expect(rules.filter((rule) => rule === 'no-restricted-imports')).toHaveLength(4);
  });

  it('запрещает глобалы браузера', () => {
    const rules = rulesFor('entities/board/__fixtures__/domain-purity.ts');
    expect(rules.filter((rule) => rule === 'no-restricted-globals')).toHaveLength(3);
  });

  it('запрещает Math.random', () => {
    const rules = rulesFor('entities/board/__fixtures__/domain-purity.ts');
    expect(rules).toContain('no-restricted-properties');
  });

  it('не пускает интерфейс в shared/lib', () => {
    expect(rulesFor('shared/lib/math/__fixtures__/lib-to-ui.ts')).toEqual([
      'no-restricted-imports',
    ]);
  });
});

describe('линтер ловит нарушение порядка слоёв', () => {
  it('домен не тянет наверх, в features', () => {
    expect(rulesFor('entities/board/__fixtures__/layer-upward.ts')).toEqual([
      'boundaries/dependencies',
    ]);
  });

  it('относительный путь — не лазейка мимо алиаса', () => {
    expect(rulesFor('entities/board/__fixtures__/layer-upward-relative.ts')).toEqual([
      'boundaries/dependencies',
    ]);
  });

  it('слайс не тянет в соседний слайс своего слоя', () => {
    expect(rulesFor('features/swap-tile/__fixtures__/cross-slice.ts')).toEqual([
      'boundaries/dependencies',
    ]);
  });
});

describe('линтер не мешает разрешённому', () => {
  it('домен свободно ходит вниз, в shared/lib', () => {
    expect(rulesFor('entities/board/__fixtures__/legal.ts')).toEqual([]);
  });
});
