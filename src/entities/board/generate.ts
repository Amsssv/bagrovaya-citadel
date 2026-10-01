import type { Rng } from '@/shared/lib/rng';

import type { Board, Cell, ResourceId } from './types';
import { tile } from './types';

export interface GenerateOptions {
  readonly width: number;
  readonly height: number;
  readonly resources: readonly ResourceId[];
  /** Пересдавать клетку, если она сразу замыкает тройку. */
  readonly withoutMatches: boolean;
}

const MIN_RUN = 3;

/**
 * Стартовое поле. Раскладка идёт слева направо, сверху вниз — порядок важен,
 * от него зависит воспроизводимость по сиду.
 *
 * Готовых троек на старте не бывает: ресурс выбирается из тех, что не замыкают
 * линию с уже разложенными соседями слева и сверху. Спека про пересдачу молчит,
 * поэтому это флаг `startWithoutMatches` из конфига.
 */
export function createBoard(rng: Rng, options: GenerateOptions): Board {
  const { width, height, resources, withoutMatches } = options;

  // Держим разложенное отдельным массивом ресурсов: разбирать Cell ради
  // соседей незачем, а лишняя проверка на undefined только путала бы.
  const placed: ResourceId[] = [];

  const runLeft = (x: number, y: number, resource: ResourceId): number => {
    let length = 0;
    while (x - length - 1 >= 0 && placed[y * width + x - length - 1] === resource) length++;
    return length;
  };

  const runUp = (x: number, y: number, resource: ResourceId): number => {
    let length = 0;
    while (y - length - 1 >= 0 && placed[(y - length - 1) * width + x] === resource) length++;
    return length;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const allowed = withoutMatches
        ? resources.filter(
            (resource) =>
              runLeft(x, y, resource) < MIN_RUN - 1 && runUp(x, y, resource) < MIN_RUN - 1,
          )
        : resources;

      if (allowed.length === 0) {
        throw new Error(
          `Из ${String(resources.length)} ресурсов нельзя разложить поле без готовых троек`,
        );
      }
      placed.push(rng.pick(allowed));
    }
  }

  const cells: Cell[] = placed.map((resource) => tile(resource));
  return { width, height, cells };
}
