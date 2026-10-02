import { existsSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { AtlasMap } from './atlas';
import type { OurAtlas } from './ourAtlas';
import {
  OPTIONAL_ANIMS,
  OPTIONAL_FRAMES,
  atlasAnimLoops,
  REQUIRED_ANIMS,
  REQUIRED_FRAMES,
  atlasAnimFor,
  atlasFrameFor,
  atlasProblems,
  shotFrameFor,
} from './atlas';

/** Годный атлас: все кадры по клетке, анимации из одного кадра. */
function complete(): AtlasMap {
  const frames = Object.fromEntries(
    [...REQUIRED_FRAMES, 'hunter-1', 'preacher-1'].map((name) => [name, [0, 0, 48, 48] as const]),
  );
  return { cell: 48, frames, anims: { hunter: ['hunter-1'], preacher: ['preacher-1'] } };
}

describe('обязательные кадры', () => {
  it('5 плиток, 4 постройки × 4 ступени и 4 потира; замок — отдельная картинка поля', () => {
    expect(REQUIRED_FRAMES).toHaveLength(5 + 16 + 4);
    expect(REQUIRED_FRAMES).not.toContain('castle');
    expect(REQUIRED_FRAMES).toContain('tile-blood');
    expect(REQUIRED_FRAMES).toContain('gargoyle-crimson');
    expect(REQUIRED_FRAMES).toContain('potion-raw');
  });

  it('анимации — полёт солдата и босса', () => {
    expect(REQUIRED_ANIMS).toEqual(['hunter', 'preacher']);
  });

  it('имена не повторяются', () => {
    expect(new Set(REQUIRED_FRAMES).size).toBe(REQUIRED_FRAMES.length);
  });
});

describe('проверка атласа', () => {
  it('полный атлас годится', () => {
    expect(atlasProblems(complete())).toEqual([]);
  });

  it('называет каждый недостающий кадр', () => {
    const map = complete();
    const { 'potion-raw': _potion, 'vine-bone': _vine, ...frames } = map.frames;
    expect(atlasProblems({ ...map, frames })).toEqual([
      'нет кадра «vine-bone»',
      'нет кадра «potion-raw»',
    ]);
  });

  it('нет анимации — не годится', () => {
    const map = complete();
    expect(atlasProblems({ ...map, anims: { hunter: ['hunter-1'] } })).toEqual([
      'нет анимации «preacher»',
    ]);
  });

  it('пустая анимация — всё равно что нет', () => {
    const map = complete();
    expect(atlasProblems({ ...map, anims: { ...map.anims, hunter: [] } })).toEqual([
      'нет анимации «hunter»',
    ]);
  });

  it('анимация со ссылкой на несуществующий кадр — не годится', () => {
    const map = complete();
    expect(atlasProblems({ ...map, anims: { ...map.anims, hunter: ['hunter-9'] } })).toEqual([
      'анимация «hunter» ссылается на кадр «hunter-9», которого нет',
    ]);
  });

  it('клетка нулевого размера — не годится', () => {
    expect(atlasProblems({ ...complete(), cell: 0 })).toEqual([
      'cell: размер клетки должен быть больше нуля',
    ]);
  });
});

describe('кадр для клетки', () => {
  it('плитка, потир и постройка — по виду и ступени', () => {
    expect(atlasFrameFor({ kind: 'tile', resource: 'fog' })).toBe('tile-fog');
    expect(atlasFrameFor({ kind: 'potion', tier: 'bone' })).toBe('potion-bone');
    expect(atlasFrameFor({ kind: 'building', building: 'mortar', tier: 'crimson' })).toBe(
      'mortar-crimson',
    );
  });

  it('пустая клетка — без кадра', () => {
    expect(atlasFrameFor({ kind: 'empty' })).toBeNull();
  });

  it('каждый кадр, который может понадобиться клетке, есть в списке обязательных', () => {
    const cells = [
      ...['stone', 'thorn', 'ash', 'fog', 'blood'].map(
        (resource) => ({ kind: 'tile', resource }) as const,
      ),
      ...['raw', 'bone', 'obsidian', 'crimson'].flatMap((tier) => [
        { kind: 'potion', tier } as const,
        ...['gargoyle', 'vine', 'mortar', 'fogveil'].map(
          (building) => ({ kind: 'building', building, tier }) as const,
        ),
      ]),
    ];
    for (const cell of cells) expect(REQUIRED_FRAMES).toContain(atlasFrameFor(cell));
  });
});

describe('кадры атак', () => {
  it('снаряд у каждой стреляющей постройки на каждой ступени, плюс взрыв и тень', () => {
    expect(OPTIONAL_FRAMES.filter((name) => name.startsWith('shot-'))).toHaveLength(3 * 4 + 2);
    expect(OPTIONAL_FRAMES).toContain('shot-gargoyle-crimson');
    expect(OPTIONAL_FRAMES).toContain('shot-explosion');
  });

  it('кадр снаряда — по виду и ступени; завеса не стреляет', () => {
    expect(shotFrameFor('vine', 'bone')).toBe('shot-vine-bone');
    expect(shotFrameFor('fogveil', 'raw')).toBeNull();
    for (const building of ['gargoyle', 'vine', 'mortar']) {
      expect(OPTIONAL_FRAMES).toContain(shotFrameFor(building, 'obsidian'));
    }
  });

  it('без них атлас всё равно годится', () => {
    expect(atlasProblems(complete())).toEqual([]);
    expect(Object.keys(complete().frames).some((name) => name.startsWith('shot-'))).toBe(false);
  });
});

describe('эффекты', () => {
  it('облако гибели — необязательный кадр, пламя — необязательная анимация', () => {
    expect(OPTIONAL_FRAMES).toContain('fx-death');
    expect(OPTIONAL_ANIMS).toEqual(['fx-fire']);
  });

  it('эффект играет один раз, полёт врага — по кругу', () => {
    expect(atlasAnimLoops('fx-fire')).toBe(false);
    expect(atlasAnimLoops('hunter')).toBe(true);
    expect(atlasAnimLoops('preacher')).toBe(true);
    expect(atlasAnimLoops('hunter-death')).toBe(false);
    expect(atlasAnimLoops('preacher-death')).toBe(false);
    expect(atlasAnimLoops('fx-merge')).toBe(false);
  });

  it('без эффектов атлас всё равно годится', () => {
    expect(atlasProblems(complete())).toEqual([]);
  });
});

describe('облака под полем', () => {
  it('задняя и передняя полосы — необязательные кадры', () => {
    expect(OPTIONAL_FRAMES).toContain('cloud-back');
    expect(OPTIONAL_FRAMES).toContain('cloud-front');
    expect(REQUIRED_FRAMES).not.toContain('cloud-back');
  });
});

describe('анимация врага', () => {
  it('у босса своя, остальные летят солдатом', () => {
    expect(atlasAnimFor('preacher')).toBe('preacher');
    expect(atlasAnimFor('hunter')).toBe('hunter');
    expect(atlasAnimFor('неизвестный')).toBe('hunter');
  });
});

/**
 * Размер картинки из заголовка: PNG (атлас оригинала) или WebP (атлас
 * дизайнера) — без декодера, по байтам.
 */
function imageSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  if (bytes.toString('ascii', 1, 4) === 'PNG') {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error(`${file}: не PNG и не WebP`);
  }
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  if (chunk === 'VP8 ') {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  throw new Error(`${file}: незнакомый WebP (${chunk})`);
}

/** Кадры, которые вылезают за край картинки. */
function outside(map: AtlasMap, size: { width: number; height: number }): string[] {
  return Object.entries(map.frames)
    .filter(([, [x, y, w, h]]) => x < 0 || y < 0 || x + w > size.width || y + h > size.height)
    .map(([name]) => name);
}

// Настоящие атласы проверяются, только если лежат в проекте: атлас дизайнера
// идёт в сборку, атлас оригинала — только локально, в original/ (.gitignore).
for (const [title, dir, picture] of [
  ['атлас дизайнера', 'src/shared/assets/atlas', 'texture.webp'],
  ['атлас оригинала (локально)', 'original', 'texture.png'],
] as const) {
  const json = `${dir}/atlas.json`;
  const image = `${dir}/${picture}`;
  describe.skipIf(!existsSync(json) || !existsSync(image))(title, () => {
    it('годится: все кадры и анимации на месте', () => {
      expect(atlasProblems(JSON.parse(readFileSync(json, 'utf8')) as AtlasMap)).toEqual([]);
    });

    it('каждый кадр помещается в картинку', () => {
      const map = JSON.parse(readFileSync(json, 'utf8')) as AtlasMap;
      expect(outside(map, imageSize(image))).toEqual([]);
    });

    // Картинку пересжали с другим размером — кадры atlas.json съезжают.
    it('размер листа в atlas.json совпадает с картинкой', () => {
      const map = JSON.parse(readFileSync(json, 'utf8')) as OurAtlas;
      if (map.size === undefined) return;
      const { width, height } = imageSize(image);
      expect([width, height]).toEqual(map.size);
    });
  });
}
