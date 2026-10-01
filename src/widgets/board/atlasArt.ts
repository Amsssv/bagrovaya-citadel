import Phaser from 'phaser';

import type { AtlasMap } from '@/shared/art';
import { OUR_ATLAS_MAP_URL, OUR_ATLAS_TEXTURE, atlasAnimLoops, atlasProblems } from '@/shared/art';

/**
 * Арт поля из атласа (формат и список кадров — docs/atlas.md).
 *
 * Откуда берётся атлас:
 *   1. **атлас дизайнера, по умолчанию** — `src/shared/assets/atlas/texture.png`
 *      и `atlas.json`. Лежит — работает и в сборке, и в dev;
 *   2. **dev-сервер с `?art=original`** — арт оригинала из `original/` (папка в
 *      .gitignore), для сравнения. ⚠️ Он чужой и в сборку не попадает никогда:
 *      ветка `import.meta.env.DEV` в сборке мёртвая, адресов файлов в `dist` нет;
 *   3. **ничего нет или атлас неполный** — игра рисует заглушки: SVG-иконки на
 *      плашках, капли-метки врагов и облака, нарисованные кодом.
 */
export const ATLAS = 'field-atlas';
const MAP = 'field-atlas-map';

interface AtlasSource {
  readonly texture: string;
  readonly map: string;
}

function chooseSource(): AtlasSource | null {
  if (import.meta.env.DEV) {
    // Арт оригинала — только для сравнения на своей машине, см. шапку.
    if (new URLSearchParams(window.location.search).get('art') === 'original') {
      return { texture: '/original/texture.png', map: '/original/atlas.json' };
    }
  }
  if (OUR_ATLAS_TEXTURE !== undefined && OUR_ATLAS_MAP_URL !== undefined) {
    return { texture: OUR_ATLAS_TEXTURE, map: OUR_ATLAS_MAP_URL };
  }
  return null;
}

/** Поставить атлас в очередь загрузки, если он есть. */
export function queueAtlas(load: Phaser.Loader.LoaderPlugin): void {
  const source = chooseSource();
  if (source === null) return;
  load.image(ATLAS, source.texture);
  load.json(MAP, source.map);
}

/**
 * Нарезать атлас на кадры и завести анимации полёта. null — атласа нет, он не
 * загрузился или в нём не хватает кадров (что именно — в консоли): тогда игра
 * остаётся на прежнем арте.
 */
export function installAtlas(scene: Phaser.Scene): AtlasMap | null {
  if (!scene.textures.exists(ATLAS)) return null;
  const map = scene.cache.json.get(MAP) as AtlasMap | undefined;
  if (map === undefined) return null;

  const problems = atlasProblems(map);
  if (problems.length > 0) {
    console.warn(`Атлас поля не годится, рисуем прежний арт:\n  ${problems.join('\n  ')}`);
    return null;
  }

  const texture = scene.textures.get(ATLAS);
  for (const [name, [x, y, w, h]] of Object.entries(map.frames)) {
    if (!texture.has(name)) texture.add(name, 0, x, y, w, h);
  }
  for (const [name, frames] of Object.entries(map.anims)) {
    const key = animKey(name);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: frames.map((frame) => ({ key: ATLAS, frame })),
      frameRate: ATLAS_FRAME_RATE,
      repeat: atlasAnimLoops(name) ? -1 : 0,
    });
  }
  return map;
}

/** Кадров в секунду у анимаций атласа — как в оригинале. */
const ATLAS_FRAME_RATE = 11;

export function animKey(name: string): string {
  return `atlas-${name}`;
}
