import type { CSSProperties } from 'react';

import { OUR_ATLAS, OUR_ATLAS_TEXTURE, spriteBox } from '@/shared/art';

/**
 * Кадр атласа дизайнера в интерфейсе — тот же арт, что на поле. Кадр
 * вписывается в квадрат `size` (в пикселях) и стоит по центру.
 *
 * Атласа или кадра нет — ничего не рисует: вызывающий показывает своё.
 */
export interface SpriteProps {
  readonly frame: string;
  readonly size: number;
  readonly className?: string;
}

export function hasSprite(frame: string): boolean {
  return OUR_ATLAS_TEXTURE !== undefined && spriteBox(OUR_ATLAS, frame, 1) !== null;
}

export function Sprite({ frame, size, className }: SpriteProps) {
  const box = spriteBox(OUR_ATLAS, frame, size);
  if (box === null || OUR_ATLAS_TEXTURE === undefined) return null;
  const outer: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flex: '0 0 auto',
  };
  const inner: CSSProperties = {
    width: box.width,
    height: box.height,
    backgroundImage: `url("${OUR_ATLAS_TEXTURE}")`,
    backgroundSize: `${String(box.sheetWidth)}px ${String(box.sheetHeight)}px`,
    backgroundPosition: `${String(box.offsetX)}px ${String(box.offsetY)}px`,
    backgroundRepeat: 'no-repeat',
  };
  return (
    <span className={className} style={outer} aria-hidden="true">
      <span style={inner} />
    </span>
  );
}
