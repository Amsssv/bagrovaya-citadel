import { describe, expect, it } from 'vitest';

import { BUILDINGS, TIERS } from '@/entities/building';
import { BUILDING_ARTS, TIER_ARTS, TIER_TINT, TILE_ARTS } from '@/shared/art';

import { BUILDING_ICON } from './icons';
import { HARVEST } from '@/entities/board';

/**
 * `shared` не имеет права знать про `entities`, поэтому списки видов и ступеней
 * в арте объявлены заново. Разойтись они не должны: новая постройка или новая
 * ступень обязана остаться без картинки громко, а не молча.
 */
describe('арт и домен не разошлись', () => {
  it('виды построек совпадают с доменными', () => {
    expect([...BUILDING_ARTS]).toEqual([...BUILDINGS]);
  });

  it('ресурсы плиток совпадают с доменными', () => {
    expect([...TILE_ARTS].sort()).toEqual(Object.keys(HARVEST).sort());
  });

  it('ступени совпадают с доменными', () => {
    expect([...TIER_ARTS]).toEqual([...TIERS]);
  });

  it('у каждой постройки есть запасной глиф, у каждой ступени — цвет', () => {
    for (const building of BUILDINGS) expect(BUILDING_ICON[building]).toBeTruthy();
    for (const tier of TIERS) expect(TIER_TINT[tier]).toBeTypeOf('number');
  });
});
