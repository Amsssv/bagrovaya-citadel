/**
 * Атлас арта поля: одна картинка `texture.webp` и описание `atlas.json`.
 *
 * Формат — docs/atlas.md; там же список кадров для дизайнера. Здесь — то,
 * что проверяется без движка: какие кадры обязаны быть, какой кадр рисовать
 * для клетки и какая анимация у врага.
 *
 * Кадр рисуется в масштабе `клетка на экране / cell` и стоит серединой нижнего
 * края на нижнем краю клетки: высокие башни торчат вверх, на клетку выше.
 */
export type AtlasRect = readonly [x: number, y: number, width: number, height: number];

export interface AtlasMap {
  /** Размер клетки в точках атласа, под который нарисован весь арт. */
  readonly cell: number;
  readonly frames: Readonly<Record<string, AtlasRect>>;
  /** Анимация → кадры по порядку, по кругу. */
  readonly anims: Readonly<Record<string, readonly string[]>>;
}

const RESOURCES = ['stone', 'thorn', 'ash', 'fog', 'blood'] as const;
const BUILDINGS = ['gargoyle', 'vine', 'mortar', 'fogveil'] as const;
const TIERS = ['raw', 'bone', 'obsidian', 'crimson'] as const;

/** Кадры, без которых атлас не годится: игра их запрашивает. */
export const REQUIRED_FRAMES: readonly string[] = [
  ...RESOURCES.map((resource) => `tile-${resource}`),
  ...BUILDINGS.flatMap((building) => TIERS.map((tier) => `${building}-${tier}`)),
  ...TIERS.map((tier) => `potion-${tier}`),
];

/** Кто из построек стреляет снарядом. Завеса не стреляет. */
const SHOOTERS = ['gargoyle', 'vine', 'mortar'] as const;

/**
 * Кадры атак — **необязательные**: без них атлас годится, а атаки рисуются
 * линиями и точками. Стрела горгульи и болт лозы нарисованы **остриём вниз** и
 * поворачиваются по полёту; ядро мортиры летит по дуге, с тенью, и лопается
 * взрывом.
 */
export const OPTIONAL_FRAMES: readonly string[] = [
  ...SHOOTERS.flatMap((building) => TIERS.map((tier) => `shot-${building}-${tier}`)),
  'shot-explosion',
  'shot-shadow',
  // Гибель врага: облачко крутится и гаснет на месте погибшего.
  'fx-death',
  // Облака под полем, как в оригинале: полоса повторяется по ширине экрана,
  // а ниже неё до края экрана — заливка цветом нижнего ряда кадра.
  'cloud-back',
  'cloud-front',
];

/**
 * Необязательные анимации эффектов. Играют **один раз**, а не по кругу:
 * `fx-fire` — пламя у ворот, когда враг бьёт цитадель, и там, где лопнуло ядро.
 */
export const OPTIONAL_ANIMS: readonly string[] = ['fx-fire'];

/** Анимация играет один раз — эффект, — или по кругу, как полёт врага. */
export function atlasAnimLoops(name: string): boolean {
  // Эффекты (`fx-…`) и гибель (`…-death`) играют один раз; ходьба — по кругу.
  return !OPTIONAL_ANIMS.includes(name) && !name.startsWith('fx-') && !name.endsWith('-death');
}

/** Кадр снаряда этой постройки. null — постройка не стреляет. */
export function shotFrameFor(building: string, tier: string): string | null {
  return (SHOOTERS as readonly string[]).includes(building) ? `shot-${building}-${tier}` : null;
}

/** Анимации, без которых атлас не годится: полёт врагов. */
export const REQUIRED_ANIMS: readonly string[] = ['hunter', 'preacher'];

/** Чего в атласе не хватает. Пусто — атлас годится. */
export function atlasProblems(map: AtlasMap): string[] {
  const problems: string[] = [];
  if (!(map.cell > 0)) problems.push('cell: размер клетки должен быть больше нуля');
  for (const name of REQUIRED_FRAMES) {
    if (map.frames[name] === undefined) problems.push(`нет кадра «${name}»`);
  }
  for (const name of REQUIRED_ANIMS) {
    const frames = map.anims[name];
    if (frames === undefined || frames.length === 0) {
      problems.push(`нет анимации «${name}»`);
      continue;
    }
    for (const frame of frames) {
      if (map.frames[frame] === undefined) {
        problems.push(`анимация «${name}» ссылается на кадр «${frame}», которого нет`);
      }
    }
  }
  return problems;
}

/** Что стоит в клетке — в том объёме, который нужен для выбора кадра. */
export type AtlasCell =
  | { readonly kind: 'empty' }
  | { readonly kind: 'tile'; readonly resource: string }
  | { readonly kind: 'potion'; readonly tier: string }
  | { readonly kind: 'building'; readonly building: string; readonly tier: string };

/** Кадр клетки. null — пустая клетка, рисовать нечего. */
export function atlasFrameFor(cell: AtlasCell): string | null {
  switch (cell.kind) {
    case 'empty':
      return null;
    case 'tile':
      return `tile-${cell.resource}`;
    case 'potion':
      return `potion-${cell.tier}`;
    case 'building':
      return `${cell.building}-${cell.tier}`;
  }
}

/** Анимация врага. Босс — своя; любой другой вид летит солдатом. */
export function atlasAnimFor(kind: string): string {
  return kind === 'preacher' ? 'preacher' : 'hunter';
}
