import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * Слои FSD сверху вниз. Импортировать можно только строго ниже себя.
 *
 * Исключение одно: entities → entities. Симуляция ночи живёт в entities/wave и
 * обязана собирать врагов, постройки, поле и цитадель; запретить это — значит
 * растащить домен по слоям, которым он не принадлежит. Внутри shared импорты
 * тоже разрешены: это инструментальный слой.
 */
const LAYERS = ['app', 'processes', 'pages', 'widgets', 'features', 'entities', 'shared'];
const below = (layer) => LAYERS.slice(LAYERS.indexOf(layer) + 1);

/** Всё, чего домен не имеет права знать: фреймворки, рендер, стили, платформа. */
const FORBIDDEN_IN_DOMAIN = [
  'react',
  'react-dom',
  'react-dom/*',
  'react/*',
  'phaser',
  'zustand',
  'zustand/*',
  '*.scss',
  '*.css',
  '*.module.scss',
  '@/shared/ui',
  '@/shared/ui/*',
  '@/shared/phaser',
  '@/shared/phaser/*',
  '@/shared/api',
  '@/shared/api/*',
  '@/shared/audio',
  '@/shared/audio/*',
];

/** Глобалы браузера: домен должен считаться и в Node, и в воркере, и в тесте. */
const FORBIDDEN_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'fetch',
  'XMLHttpRequest',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
  'alert',
  'confirm',
];

export default tseslint.config(
  // Фикстуры сломаны намеренно. В обычном прогоне их не видно, а
  // tests/eslint-rules.test.ts линтует их через --no-ignore и проверяет,
  // что каждое правило действительно сработало.
  { ignores: ['dist', 'coverage', 'node_modules', '.demo', 'original', '**/__fixtures__/**'] },

  js.configs.recommended,
  tseslint.configs.recommended,

  // ── Общее для всего проекта ──
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Правило 1: Math.random запрещён везде, включая тесты. Без единого
      // источника случайности не существует ни воспроизводимости боя, ни общего
      // сида ежедневных заданий. Только createRng из @/shared/lib/rng.
      // Заглушки-реализации интерфейса обязаны принимать его параметры, даже
      // если пока ничего с ними не делают. Подчёркивание — договорённость.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random запрещён. Используй createRng(seed) из @/shared/lib/rng.',
        },
      ],
    },
  },

  // ── Правило 2: слои FSD ──
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // Без резолвера правило слоёв молча пропускает всё: импорт, который не
      // удалось разрешить, для плагина — неизвестный модуль, а неизвестное он не
      // проверяет. Резолвер TypeScript берёт «@/*» прямо из tsconfig, поэтому
      // алиас описан ровно в одном месте.
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: false },
        { type: 'processes', pattern: 'src/processes/(*)', capture: ['slice'], partialMatch: false },
        { type: 'pages', pattern: 'src/pages/(*)', capture: ['slice'], partialMatch: false },
        { type: 'widgets', pattern: 'src/widgets/(*)', capture: ['slice'], partialMatch: false },
        { type: 'features', pattern: 'src/features/(*)', capture: ['slice'], partialMatch: false },
        { type: 'entities', pattern: 'src/entities/(*)', capture: ['slice'], partialMatch: false },
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          message:
            'FSD: импортировать можно только нижележащие слои, а внутри своего слоя — только свой слайс',
          policies: [
            ...LAYERS.map((layer) => ({
              from: { element: { type: layer } },
              allow: [
                // вниз по слоям — всегда
                { to: { element: { types: { anyOf: below(layer) } } } },
                // внутрь себя — только в свой же слайс
                {
                  to: {
                    element: {
                      type: layer,
                      captured: { slice: '{{ from.element.captured.slice }}' },
                    },
                  },
                },
              ],
            })),
            // Исключение: домен собирается из нескольких сущностей. simulateNight
            // живёт в entities/wave и обязан знать про врагов, постройки, поле и
            // цитадель — запрет растащил бы домен по чужим слоям.
            {
              from: { element: { type: 'entities' } },
              allow: { to: { element: { type: 'entities' } } },
            },
          ],
        },
      ],
    },
  },

  // ── Правило 3: домен чист ──
  {
    files: ['src/entities/**/*.ts', 'src/shared/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: FORBIDDEN_IN_DOMAIN,
              message:
                'Домен не знает ни про React, ни про Phaser, ни про DOM, ни про платформу. Чистый TypeScript.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...FORBIDDEN_GLOBALS.map((name) => ({
          name,
          message:
            'Домен должен считаться и в браузере, и в Node (бот, тесты). Глобалы браузера сюда не попадают.',
        })),
      ],
    },
  },

  // ── React-слой ──
  {
    files: ['src/{app,processes,pages,widgets,features}/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
