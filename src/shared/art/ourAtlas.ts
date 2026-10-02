import type { AtlasMap, AtlasRect } from './atlas';

/**
 * Атлас дизайнера (`src/shared/assets/atlas/`), если он лежит в проекте.
 * Файлов нет — всё здесь `undefined`, и игра идёт на заглушках.
 *
 * Полю нужны адреса файлов (их грузит Phaser), интерфейсу — сами кадры, чтобы
 * рисовать их через CSS (справка показывает тот же арт, что поле).
 */
function first<T>(files: Record<string, T>): T | undefined {
  return Object.values(files)[0];
}

export const OUR_ATLAS_TEXTURE = first(
  import.meta.glob<string>('/src/shared/assets/atlas/texture.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

export const OUR_ATLAS_MAP_URL = first(
  import.meta.glob<string>('/src/shared/assets/atlas/atlas.json', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/** Кадры атласа с размером листа — `size` пишет scripts/build-atlas.py. */
export type OurAtlas = AtlasMap & { readonly size?: readonly [number, number] };

export const OUR_ATLAS = first(
  import.meta.glob<OurAtlas>('/src/shared/assets/atlas/atlas.json', {
    eager: true,
    import: 'default',
  }),
);

export interface SpriteBox {
  readonly width: number;
  readonly height: number;
  /** Картинка листа, растянутая так, что кадр встаёт в рамку. */
  readonly sheetWidth: number;
  readonly sheetHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

/**
 * Где на листе кадр и как его растянуть, чтобы он вписался в квадрат `box`
 * целиком, без искажений. null — кадра или размера листа нет.
 */
export function spriteBox(
  atlas: OurAtlas | undefined,
  frame: string,
  box: number,
): SpriteBox | null {
  const rect: AtlasRect | undefined = atlas?.frames[frame];
  const size = atlas?.size;
  if (rect === undefined || size === undefined) return null;
  const [x, y, width, height] = rect;
  if (width <= 0 || height <= 0) return null;
  const scale = box / Math.max(width, height);
  return {
    width: width * scale,
    height: height * scale,
    sheetWidth: size[0] * scale,
    sheetHeight: size[1] * scale,
    offsetX: -x * scale,
    offsetY: -y * scale,
  };
}
