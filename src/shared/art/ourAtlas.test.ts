import { describe, expect, it } from 'vitest';

import { OUR_ATLAS, spriteBox } from './ourAtlas';

const ATLAS = {
  cell: 128,
  size: [1000, 500] as const,
  frames: { tall: [100, 50, 50, 200] as const, flat: [0, 0, 0, 10] as const },
  anims: {},
};

describe('кадр атласа для интерфейса', () => {
  it('вписывается в рамку целиком: высокий — по высоте', () => {
    const box = spriteBox(ATLAS, 'tall', 40);
    expect(box).toEqual({
      width: 10,
      height: 40,
      sheetWidth: 200,
      sheetHeight: 100,
      offsetX: -20,
      offsetY: -10,
    });
  });

  it('нет кадра, пустой кадр или нет размера листа — null', () => {
    expect(spriteBox(ATLAS, 'нет', 40)).toBeNull();
    expect(spriteBox(ATLAS, 'flat', 40)).toBeNull();
    const { size: _size, ...unsized } = ATLAS;
    expect(spriteBox(unsized, 'tall', 40)).toBeNull();
    expect(spriteBox(undefined, 'tall', 40)).toBeNull();
  });

  it('атлас дизайнера в проекте несёт размер листа', () => {
    expect(OUR_ATLAS?.size).toHaveLength(2);
    expect(spriteBox(OUR_ATLAS, 'tile-stone', 40)).not.toBeNull();
  });
});
