import Phaser from 'phaser';

/**
 * Растровый шрифт из одних цифр, собираемый на лету.
 *
 * Цифры урона обязаны быть Bitmap Text, а не обычным Text: во время боя их
 * появляются десятки в секунду, и каждый обычный Text — это своя текстура и
 * перерисовка. Bitmap Text рисуется из одной готовой.
 *
 * Готового шрифта в проекте нет, тащить ради десяти знаков файл не хочется —
 * поэтому атлас рисуется в канвас при первом запуске сцены.
 */
export const DIGIT_FONT = 'battle-digits';

const CHARS = '0123456789';
const CELL_WIDTH = 24;
const CELL_HEIGHT = 32;
const SOURCE_KEY = 'battle-digits-source';

export function ensureDigitFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.has(DIGIT_FONT)) return;

  const texture = scene.textures.createCanvas(SOURCE_KEY, CELL_WIDTH * CHARS.length, CELL_HEIGHT);
  if (texture === null) return;

  const context = texture.getContext();
  context.font = `bold ${String(CELL_HEIGHT - 6)}px system-ui, sans-serif`;
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let i = 0; i < CHARS.length; i++) {
    context.fillText(CHARS[i] as string, i * CELL_WIDTH + CELL_WIDTH / 2, CELL_HEIGHT / 2);
  }
  texture.refresh();

  scene.cache.bitmapFont.add(
    DIGIT_FONT,
    Phaser.GameObjects.RetroFont.Parse(scene, {
      image: SOURCE_KEY,
      width: CELL_WIDTH,
      height: CELL_HEIGHT,
      chars: CHARS,
      charsPerRow: CHARS.length,
      'offset.x': 0,
      'offset.y': 0,
      'spacing.x': 0,
      'spacing.y': 0,
      lineSpacing: 0,
    }),
  );
}
