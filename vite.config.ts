import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Относительные пути: на Яндекс Играх сборка открывается из подпапки, и
  // абсолютные /assets/... там не находятся.
  base: './',
  build: {
    // Phaser грузит картинки своим загрузчиком и ждёт файл. Vite по умолчанию
    // вшивает мелкие ассеты в бандл как data-URI: загрузчик SVG на них прямо
    // спотыкается, а мелкие листы кадров молча уезжают в бандл и перестают
    // кешироваться отдельно. Поэтому картинки — всегда файлами. Описание
    // атласа тоже: его забирает тот же загрузчик.
    assetsInlineLimit: (filePath: string) =>
      /\.(svg|png|webp)$|atlas\.json$/.test(filePath) ? false : undefined,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/entities/**', 'src/shared/lib/**', 'src/shared/phaser/pool.ts', 'src/shared/api/**', 'src/shared/art/**', 'src/shared/audio/manager.ts', 'src/shared/audio/tension.ts', 'src/processes/night/**', 'src/features/watch-rewarded-ad/reward.ts', 'src/widgets/records/records.ts', 'src/widgets/citadel-picker/picker.ts', 'src/widgets/board/layout.ts', 'src/widgets/board/drag.ts', 'src/widgets/board/timeline.ts', 'src/widgets/board/battle.ts', 'src/widgets/board/quality.ts', 'src/widgets/board/water.ts', 'src/features/adjust-sound/sound.ts', 'src/features/tutorial/script.ts', 'src/features/tutorial/tips.ts', 'src/shared/audio/music.ts'],
      exclude: ['**/__fixtures__/**', '**/__testing__/**'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
