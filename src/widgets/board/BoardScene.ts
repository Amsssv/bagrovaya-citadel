import Phaser from 'phaser';

import type { Board, BuildingCell, Cell, MoveStage } from '@/entities/board';
import type { BuildingId, Tier } from '@/entities/building';
import { TIERS } from '@/entities/building';
import { longMatchBonus } from '@/entities/player';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import type { NightEvent } from '@/entities/wave';
import type { Direction, Position } from '@/shared/lib/geometry';
import { step } from '@/shared/lib/geometry';
import type { AtlasMap } from '@/shared/art';
import { atlasAnimFor, atlasFrameFor, shotFrameFor, TIER_TINT } from '@/shared/art';
import type { Audio } from '@/shared/audio';
import type { Pool } from '@/shared/phaser';
import { DIGIT_FONT, createPool, ensureDigitFont } from '@/shared/phaser';
import { reportLoading } from '@/shared/ui';

import type { BattleCue } from './battle';
import { HIT_FLASH_MS, buildCues, hitFlashTint } from './battle';
import { dragDirection } from './drag';
import { filterFor } from './filter';
import {
  BOARD_ART,
  BOARD_ART_URL,
  BOARD_GRID_INSET,
  CASTLE_ART,
  CASTLE_ART_URL,
  CASTLE_LAYER,
  FIELD_SIZE,
  GATE_GRASS_ART,
  GATE_GRASS_ART_URL,
  GATE_GRASS_LAYER,
  TURRET_SPOTS,
  WATER_DECOR_ART,
  WATER_DECOR_FRAMES,
  WATER_DECOR_URL,
  BUILDING_ICON,
  ICON_SIZE,
  POTION_ICON,
  TILE_ICON,
} from './icons';
import type { BoardSize, SceneLayout } from './layout';
import { artToScreen, cellToScreen, cloudBands, computeSceneLayout, screenToCell } from './layout';
import { ATLAS, animKey, installAtlas, queueAtlas } from './atlasArt';
import { CELL_GAP, DAMAGE_COLOR, POTION_COLOR, SHOT_COLOR, TIER_PIP, TILE_COLOR } from './palette';
import { DAYLIGHT_MS, lightTint, mixTint, multiplyTint } from './daylight';
import type { Quality, QualityPlan } from './quality';
import { planFor } from './quality';
import type { Speed } from './timeline';
import { DURATION, dealDelay, fallDuration, gatherTargets } from './timeline';
import type { DecorFrame } from './water';
import { WATER_PIXEL, scatterDecor, waterTile } from './water';

/**
 * Сцена рисует **только поле**: плитки, постройки, потиры. Ни кнопок, ни
 * надписей, ни модалок — всё это React поверх канваса. Единственное исключение
 * появится на шаге 10г: цифры урона, их слишком много и они привязаны к юнитам.
 *
 * Арт поля — из атласа (docs/atlas.md); без атласа — простые фигуры,
 * нарисованные кодом (`ensureGlyphs`). Сторонних иконок в игре нет.
 */
/**
 * Облака под полем (docs/atlas.md → «Облака»). Скорость — точек арта в
 * секунду, как в оригинале: 0,6 и 0,9 точки за кадр при 60 кадрах. Плывут
 * только в бою, на Рассвете.
 */
const CLOUD_DEPTH = 4.5;
/** Подсветка полосы босса — алая, в цвет крови интерфейса. */
const BOSS_LANE_COLOR = 0xff3b55;

/** Зона атаки — цветом своей постройки, как её тело на листе шестого прогона. */
const ZONE_COLOR: Readonly<Record<BuildingId, number>> = {
  gargoyle: 0x6fd6ff,
  vine: 0xb6f25a,
  mortar: 0xff9a3c,
  fogveil: 0xc8b4f0,
};
/** Кадр атаки горгульи и кадр питья потира, мс. */
const STRIKE_FRAME_MS = 70;
/** Мортира стоит с откатом ствола, мс. */
const MORTAR_RECOIL_MS = 140;
/** Кадр вспышки попадания, мс. */
const HIT_FRAME_MS = 55;
/** Сколько лежит погибший, прежде чем погаснуть, мс: кадры гибели успевают доиграть. */
const DEATH_HOLD_MS = 380;
const DRINK_FRAME_MS = 70;
/** Полоска жизней над врагом: ширина в долях клетки и высота над центром. */
const HP_BAR_WIDTH = 0.6;
const HP_BAR_LIFT = 0.5;
/** Цвет жизней по остатку: алый, оранжево-красный, тёмно-багровый. */
const HP_BAR_FULL = 0xff4d64;
const HP_BAR_MID = 0xff7a45;
const HP_BAR_LOW = 0xc4122f;
/** След урона: сколько стоит и за сколько стекает, мс. */
const HP_TRAIL_DELAY_MS = 140;
const HP_TRAIL_MS = 360;
/** Удар по цитадели: алая вспышка замка и дрожь экрана. */
const CITADEL_HIT_TINT = 0xff3b4f;
const CITADEL_FLASH_MS = 420;
const CITADEL_SHAKE_MS = 160;
const CITADEL_SHAKE = 0.006;
/** Где на картинке поля ворота — там всплывает «−1 ♥». */
const CITADEL_GATE = { x: 844, y: 640 } as const;
/** Сколько держать палец на клетке, чтобы увидеть, что в ней, мс. */
const HOLD_MS = 450;
/** Враг в тумане завесы — в её сиреневый цвет. */
const FOG_TINT = 0xc7a8ff;
/** Во сколько раз медленнее шагает анимация врага в тумане. */
const SLOWED_ANIM_SCALE = 0.5;
/** Как быстро плывёт вода, пикселей воды в секунду. */
const WATER_DRIFT = 1.2;
const WATER_TEXTURE = 'water-tile';
const WATER_SHADE = 'water-shade';
/** Тень воды: до этой доли радиуса вода чистая, дальше темнеет к краю. */
const WATER_SHADE_CLEAR = 0.42;
const CLOUD_SPEED = { back: 36, front: 54 } as const;
/** Облака, нарисованные кодом, — под клетку оригинала, как и его арт. */
const DRAWN_CLOUD_CELL = 48;
const DRAWN_CLOUDS = {
  // top — где у полосы начинается сплошное тело, доля высоты: задняя
  // выглядывает из-за передней своими буграми.
  'cloud-back': {
    key: 'drawn-cloud-back',
    height: 144,
    top: 0.3,
    body: 0xb9c3d6,
    shade: 0x6f7090,
    seed: 3,
  },
  'cloud-front': {
    key: 'drawn-cloud-front',
    height: 110,
    top: 0.55,
    body: 0xf8f9fb,
    shade: 0xd6dbe6,
    seed: 7,
  },
} as const;
const DRAWN_CLOUD_WIDTH = 480;

interface CloudStrip {
  readonly strip: Phaser.GameObjects.TileSprite;
  /** Заливка под полосой до низа экрана — цветом её нижнего ряда. */
  readonly fill: Phaser.GameObjects.Rectangle;
  readonly color: number;
  readonly speed: number;
  /**
   * Высота кадра полосы, в точках арта. Берётся при создании: `setSize` у
   * TileSprite меняет его собственный кадр, и `strip.frame.height` потом
   * уже растянут.
   */
  readonly rows: number;
}

interface CloudLayers {
  readonly cell: number;
  readonly back: CloudStrip;
  readonly front: CloudStrip;
}
const ICON_FRACTION = 0.68;
/** Глиф постройки мельче плиточного: вокруг нужно место под рамку и точки ступени. */
const BUILDING_FRACTION = 0.62;
const LASH_COLOR = 0xff5a7a;
const LASH_CORE = 0xffe0e6;
const LASH_MS = 260;
const BLAST_COLOR = 0xff9a3c;
const BLAST_CORE = 0xfff1c4;
const BLAST_MS = 320;
const BLOOD_DROP = 'blood-drop';
const BLOOD_TINT = 0xff4d64;
/** Капля сперва зависает над группой — видно, откуда она, — потом падает к шкале. */
const BLOOD_LIFT_MS = 180;
const BLOOD_FLIGHT_MS = 620;
const BLOOD_STAGGER_MS = 110;
const BIRTH_RING_MS = 420;
const BIRTH_SPARKS = 8;
/** Сколько гаснет убитый под вспышкой. */
const DEATH_FADE_MS = 160;
/** Удар в ворота: столько персонаж бьёт, прежде чем уйти за поле. */
const STRIKE_MS = 220;
const LEAK_MS = 260;

/** Постройка в башне замка и клетка, где башня стоит (за краем поля). */
/** Зона атаки постройки: откуда бьёт и какие клетки держит. */
export interface AttackZoneView {
  readonly building: BuildingId;
  readonly origin: Position;
  readonly cells: readonly Position[];
}

export interface TurretView {
  readonly at: Position;
  readonly cell: Cell;
}

/** Враг на экране. */
/** Жизни босса для полоски: `hit` — только что попали, полоска вспыхивает. */
export interface BossHp {
  readonly hp: number;
  readonly max: number;
  readonly hit: boolean;
}

interface Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  /** Вид врага: по нему — кадры гибели. */
  readonly kind: string;
  /** Свой цвет врага: белый у кадра атласа, цвет метки у заглушки. */
  readonly tint: number;
  /** Враг в полосе тумана: сиреневый и шагает медленнее. */
  slowed: boolean;
  /** Идущее покраснение от попадания — его обрывают, когда враг уходит с поля. */
  flash: Phaser.Tweens.Tween | null;
  /** Жизни — для полоски над головой. */
  hp: number;
  readonly maxHp: number;
  /** Полоска жизней; появляется после первого попадания. */
  bar: Phaser.GameObjects.Graphics | null;
  /** След урона: бледный хвост, который стекает к нынешним жизням. */
  trail: number;
  trailTween: Phaser.Tweens.Tween | null;
}

/**
 * Эффекты боя. Своих кадров под них пока нет ни в каком арте — это вспышка-круг
 * цвета события: пыль от попадания, взрыв гибели, огонь у ворот.
 */
type SparkKind = 'dust' | 'burst' | 'fire';

const SPARK: Readonly<Record<SparkKind, { color: number; size: number; ms: number }>> = {
  dust: { color: 0xcfc2d6, size: 0.35, ms: 260 },
  burst: { color: 0xff5a6e, size: 0.9, ms: 340 },
  fire: { color: 0xffa13d, size: 0.7, ms: 300 },
};

/** Без атласа враг — капля-метка: солдат бледный, босс крупный и багровый. */
const PLACEHOLDER_ENEMY: Readonly<Record<string, { color: number; size: number }>> = {
  hunter: { color: 0xe8dcc4, size: 0.42 },
  preacher: { color: 0xd6334a, size: 0.8 },
};

const DOT = 'placeholder-dot';

/** Снаряд из атласа летит 4,8 клетки в секунду — как в оригинале. */
const SHOT_CELLS_PER_SECOND = 4.8;
const SHOT_MIN_MS = 60;
const SHOT_MAX_MS = 480;
/** Взрыв ядра в оригинале рисуется в половину своего кадра и гаснет за 15 тиков. */
const EXPLOSION_SCALE = 0.5;
const EXPLOSION_MS = 250;
/** Облачко гибели в оригинале гаснет за 21 тик. */
const DEATH_PUFF_MS = 350;
const DOT_SIZE = 64;

interface CellView {
  readonly container: Phaser.GameObjects.Container;
  /** Плашка под постройкой: по ней постройку и отличают от сырой плитки. */
  readonly plate: Phaser.GameObjects.Graphics;
  readonly icon: Phaser.GameObjects.Image;
  readonly pips: Phaser.GameObjects.Graphics;
}

export class BoardScene extends Phaser.Scene {
  static readonly KEY = 'board';

  private board: Board | null = null;
  /** Состояние, пришедшее до того, как Phaser поднял сцену. */
  private pending: Board | null = null;
  /** Атлас арта поля (docs/atlas.md). null — рисуем прежним артом. */
  private atlas: AtlasMap | null = null;
  /** Поле пришло раньше сцены и должно не появиться, а упасть сверху. */
  private pendingDeal = false;
  /**
   * Клетки, которые ещё падают при раздаче: `lift` — сколько высот поля до
   * места (1 — над полем, 0 — на месте). Хранится отдельно от позиции, потому
   * что раскладку в любой момент может пересчитать `redraw` (поворот экрана,
   * закрытая панель) — и падение должно продолжиться, а не встать на место.
   */
  private readonly dealing = new Map<number, { lift: number; alpha: number }>();
  private started = false;
  private layout: SceneLayout | null = null;
  /** Помост и цитадель: они не клетки, живут отдельно от сетки. */
  private boardArt: Phaser.GameObjects.Image | null = null;
  private citadelArt: Phaser.GameObjects.Image | null = null;
  /** Трава у ворот — поверх подножия замка и верхнего края поля. */
  private gateGrassArt: Phaser.GameObjects.Image | null = null;
  /**
   * Вода на весь экран: поле стоит на ней островом, рваный край пропадает.
   * Пиксельная плитка (water.ts) и поверх неё — тень к краям экрана.
   */
  private water: Phaser.GameObjects.TileSprite | null = null;
  private waterShade: Phaser.GameObjects.Image | null = null;
  /** Камни, кораллы и деревья в воде: пул, растёт с шириной окна. */
  private readonly decor: Phaser.GameObjects.Image[] = [];
  private decorFrames: readonly DecorFrame[] = [];
  /** Сколько вода проплыла, в секундах. */
  private waterTime = 0;
  /** Облака под полем, до низа экрана. */
  private clouds: CloudLayers | null = null;
  /** Сколько облака проплыли, в секундах боя. */
  private cloudTime = 0;
  private reserveBottom = 0;
  /** Пул видов по клеткам: во время боя новых объектов не создаём. */
  private readonly cellViews: CellView[] = [];
  private held: Phaser.GameObjects.Graphics | null = null;

  private speed: Speed = 1;
  /** Доля дня над полем: 0 — ночь Сумерек, 1 — день Рассвета. */
  private daylight = 0;
  private daylightTarget = 0;
  private daylightTween: Phaser.Tweens.Tween | null = null;
  /** Что показываем из частиц. Низкий режим гасит их совсем. */
  private plan: QualityPlan = planFor('high');
  /** Растёт на каждый пропуск: незавершённые анимации по нему отваливаются. */
  private generation = 0;

  private dragFrom: Position | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private swapHandler: ((from: Position, to: Position) => void) | null = null;
  private edgeHandler: ((from: Position, direction: Direction) => void) | null = null;
  /** Башни замка: что в них стоит. Рисуются своими видами, не клетками поля. */
  private turrets: readonly TurretView[] = [];
  /** Столбец, откуда выйдет босс этой ночи: подсвечен в Сумерках. */
  private bossLane: number | null = null;
  private pausedWanted = false;
  private laneView: Phaser.GameObjects.Graphics | null = null;
  private zone: AttackZoneView | null = null;
  private zoneView: Phaser.GameObjects.Graphics | null = null;
  private readonly turretViews: CellView[] = [];
  private tapHandler: ((at: Position) => void) | null = null;
  private inspectHandler: ((at: Position) => void) | null = null;
  private holdTimer: number | null = null;
  private readyHandler: (() => void) | null = null;
  private layoutHandler: ((layout: SceneLayout) => void) | null = null;
  private stagesDoneHandler: (() => void) | null = null;
  private bloodHandler: ((amount: number) => void) | null = null;
  /** Капли в полёте к шкале: при пропуске их гасят и засчитывают разом. */
  private bloodInFlight: Phaser.GameObjects.GameObject[] = [];
  private bloodUndelivered = 0;
  /** Итог хода, который сейчас показывается, — чтобы пропуск сразу встал на него. */
  private stagesTarget: Board | null = null;

  // ── бой ──
  private enemies: Pool<Phaser.GameObjects.Sprite> | null = null;
  /** Вспышки гибели: анимации смерти в арте нет, её играет частица. */
  private effects: Pool<Phaser.GameObjects.Image> | null = null;
  /** Пламя атласа — анимация, поэтому спрайты, а не картинки. */
  private flames: Pool<Phaser.GameObjects.Sprite> | null = null;
  private shots: Pool<Phaser.GameObjects.Image> | null = null;
  private numbers: Pool<Phaser.GameObjects.BitmapText> | null = null;
  private readonly onField = new Map<string, Actor>();
  /** Линии выстрелов лозы и мортиры, пока гаснут. */
  private readonly beams = new Set<Phaser.GameObjects.Graphics>();
  private battleTimers: Phaser.Time.TimerEvent[] = [];
  private battleGeneration = 0;
  private battleEndHandler: (() => void) | null = null;
  /** Жизни босса на поле — для полоски внизу; null — босса нет. */
  private bossHandler: ((hp: BossHp | null) => void) | null = null;
  private heartsHandler: ((hearts: number) => void) | null = null;
  /** Постройки, чья атака сейчас проигрывается. */
  private readonly striking = new Set<CellView>();
  private boss: { id: string; max: number } | null = null;
  /** Звук приходит снаружи: сцена не должна знать, как он устроен. */
  private audio: Audio | null = null;

  constructor() {
    super(BoardScene.KEY);
  }

  preload(): void {
    // Прогресс загрузчика Phaser — и есть прогресс экрана загрузки: почти весь
    // вес игры — это арт поля.
    this.load.on(Phaser.Loader.Events.PROGRESS, reportLoading);
    this.load.image(BOARD_ART, BOARD_ART_URL);
    this.load.image(CASTLE_ART, CASTLE_ART_URL);
    this.load.image(GATE_GRASS_ART, GATE_GRASS_ART_URL);
    this.load.image(WATER_DECOR_ART, WATER_DECOR_URL);
    // Атлас арта поля (docs/atlas.md), если он есть.
    queueAtlas(this.load);
  }

  create(): void {
    this.started = true;
    ensureDigitFont(this);
    this.atlas = installAtlas(this);
    this.ensurePlaceholders();
    // Помост и цитадель — самый низ сцены: по ним потом раскладывается всё
    // остальное, поэтому создаём их до клеток.
    // Поле собрано из трёх картинок: земля с сеткой, замок сверху и трава у
    // ворот поверх его подножия (docs/atlas.md → «Поле»).
    this.water = this.add
      .tileSprite(0, 0, 1, 1, ensureWaterTexture(this))
      .setOrigin(0, 0)
      .setDepth(-5);
    this.waterShade = this.add.image(0, 0, ensureWaterShade(this)).setDepth(-4);
    this.decorFrames = installDecorFrames(this);
    this.boardArt = this.add.image(0, 0, BOARD_ART).setOrigin(0, 0).setDepth(-3);
    this.citadelArt = this.add.image(0, 0, CASTLE_ART).setOrigin(0, 0).setDepth(-2);
    this.gateGrassArt = this.add.image(0, 0, GATE_GRASS_ART).setOrigin(0, 0).setDepth(-1);
    this.clouds = this.createClouds();
    this.applyDaylight();
    this.ensureShotTexture();
    this.createPools();
    this.applySpeed();
    this.held = this.add.graphics();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.redraw, this);
    this.bindInput();
    const deal = this.pendingDeal;
    this.pendingDeal = false;
    if (this.pending !== null) {
      this.board = this.pending;
      this.pending = null;
    }
    this.redraw();
    this.readyHandler?.();
    if (deal && this.board !== null) this.dealIn(this.board);
    if (this.pausedWanted) this.scene.pause();
  }

  /** Раскладка поля на экране поменялась: интерфейс ставит по ней подсказки. */
  onLayout(handler: (layout: SceneLayout) => void): void {
    this.layoutHandler = handler;
    if (this.layout !== null) handler(this.layout);
  }

  /** Сцена загрузила всё и нарисовала первое поле: можно убирать экран загрузки. */
  onReady(handler: () => void): void {
    this.readyHandler = handler;
  }

  /**
   * Новое состояние поля пришло из домена. React не обязан знать, успел ли
   * Phaser поднять сцену, — если не успел, состояние подождёт здесь.
   */
  setBoard(board: Board): void {
    if (!this.started) {
      this.pending = board;
      return;
    }
    this.board = board;
    this.redraw();
  }

  setAudio(audio: Audio | null): void {
    this.audio = audio;
  }

  setSpeed(speed: Speed): void {
    this.speed = speed;
    if (this.started) this.applySpeed();
  }

  /**
   * Режим качества. Частицы на исход боя не влияют — он посчитан целиком ещё до
   * первой картинки, — поэтому выключать их безопасно в любой момент, хоть
   * посреди Рассвета.
   */
  setQuality(quality: Quality): void {
    this.plan = planFor(quality);
    if (!this.plan.particles) this.effects?.releaseAll();
  }

  /**
   * День или ночь над полем. Смена идёт твином сцены, поэтому 2× ускоряет и
   * её: рассвет не должен отставать от боя, который уже начался.
   */
  setDaylight(day: boolean): void {
    const target = day ? 1 : 0;
    this.daylightTarget = target;
    // Полоса босса — только в Сумерках.
    if (this.started && this.layout !== null && this.board !== null) {
      this.redrawBossLane(this.layout, this.board);
    }
    this.daylightTween?.remove();
    this.daylightTween = null;

    if (!this.started) {
      this.daylight = target;
      return;
    }
    const distance = Math.abs(target - this.daylight);
    if (distance === 0) return;

    this.daylightTween = this.tweens.addCounter({
      from: this.daylight,
      to: target,
      duration: DAYLIGHT_MS * distance,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        this.daylight = tween.getValue() ?? target;
        this.applyDaylight();
      },
      onComplete: () => {
        this.daylightTween = null;
      },
    });
  }

  private applyDaylight(): void {
    const tint = lightTint(this.daylight);
    this.water?.setTint(tint);
    for (const image of this.decor) image.setTint(tint);
    this.boardArt?.setTint(tint);
    this.citadelArt?.setTint(tint);
    this.gateGrassArt?.setTint(tint);
    if (this.clouds !== null) {
      for (const layer of [this.clouds.back, this.clouds.front]) {
        layer.strip.setTint(tint);
        layer.fill.setFillStyle(multiplyTint(layer.color, tint));
      }
    }
  }

  /** Облака плывут вправо, пока идёт бой, — и быстрее на 2×. */
  override update(_time: number, delta: number): void {
    // Вода течёт всегда, еле заметно: от неё фон живой, а не картинка.
    this.waterTime += delta / 1000;
    if (this.water !== null) this.water.tilePositionX = this.waterTime * WATER_DRIFT;

    // Полоски жизней идут за врагами: враг шагает твином, полоска — следом.
    const layout = this.layout;
    if (layout !== null) {
      for (const actor of this.onField.values()) {
        actor.bar?.setPosition(actor.sprite.x, actor.sprite.y - layout.cellSize * HP_BAR_LIFT);
      }
    }

    const clouds = this.clouds;
    if (clouds === null || this.daylightTarget === 0) return;
    this.cloudTime += (delta / 1000) * this.speed;
    for (const layer of [clouds.back, clouds.front]) {
      layer.strip.tilePositionX = -this.cloudTime * layer.speed;
    }
  }

  /**
   * Полосы облаков: из атласа, если в нём есть оба кадра, иначе — нарисованные
   * кодом. Полоса повторяется по ширине экрана, под ней — заливка.
   */
  private createClouds(): CloudLayers {
    const atlas = this.atlas;
    const fromAtlas =
      atlas !== null &&
      this.textures.get(ATLAS).has('cloud-back') &&
      this.textures.get(ATLAS).has('cloud-front');
    const strip = (name: keyof typeof DRAWN_CLOUDS, speed: number, depth: number): CloudStrip => {
      const key = fromAtlas ? ATLAS : drawCloudStrip(this, DRAWN_CLOUDS[name]);
      const frame = fromAtlas ? name : undefined;
      const source = this.textures.getFrame(key, frame);
      const pixel = this.textures.getPixel(
        Math.floor(source.width / 2),
        source.height - 1,
        key,
        frame,
      );
      return {
        strip: this.add
          .tileSprite(0, 0, source.width, source.height, key, frame)
          .setOrigin(0, 0)
          .setDepth(depth),
        fill: this.add.rectangle(0, 0, 1, 1, 0xffffff).setOrigin(0, 0).setDepth(depth),
        color: pixel?.color ?? DRAWN_CLOUDS[name].body,
        speed,
        rows: source.height,
      };
    };
    return {
      cell: fromAtlas ? atlas.cell : DRAWN_CLOUD_CELL,
      back: strip('cloud-back', CLOUD_SPEED.back, CLOUD_DEPTH),
      front: strip('cloud-front', CLOUD_SPEED.front, CLOUD_DEPTH + 0.01),
    };
  }

  /**
   * Полоса босса: алый столбец под плитками и шевроны «вверх» под сеткой —
   * оттуда он выйдет. Только в Сумерках: на Рассвете он уже идёт сам.
   */
  /**
   * Зона атаки: клетки залиты цветом постройки и обведены, сама постройка —
   * ярче. Под полем (куда достают лоза и горгульи нижнего ряда) — тоже.
   */
  private redrawAttackZone(layout: SceneLayout): void {
    const zone = this.zone;
    if (zone === null || zone.cells.length === 0) {
      this.zoneView?.setVisible(false);
      return;
    }
    if (this.zoneView === null) {
      // Под плитками, над полосой босса: плитки не перекрашиваются.
      this.zoneView = this.add.graphics().setDepth(-0.4);
      this.tweens.add({
        targets: this.zoneView,
        alpha: { from: 1, to: 0.55 },
        duration: 700,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }
    const color = ZONE_COLOR[zone.building];
    const size = layout.cellSize;
    const inset = Math.max(2, size * 0.04);
    const g = this.zoneView.clear().setVisible(true);
    for (const cell of zone.cells) {
      const own = cell.x === zone.origin.x && cell.y === zone.origin.y;
      const x = layout.originX + cell.x * size + inset;
      const y = layout.originY + cell.y * size + inset;
      g.fillStyle(color, own ? 0.42 : 0.26).fillRect(x, y, size - inset * 2, size - inset * 2);
      g.lineStyle(Math.max(2, size * 0.035), color, 0.9).strokeRect(
        x,
        y,
        size - inset * 2,
        size - inset * 2,
      );
    }
  }

  private redrawBossLane(layout: SceneLayout, board: BoardSize): void {
    const lane = this.bossLane;
    if (lane === null || this.daylightTarget === 1 || lane < 0 || lane >= board.width) {
      this.laneView?.setVisible(false);
      return;
    }
    if (this.laneView === null) {
      // Над картинкой поля, под плитками: плитки не перекрашиваются.
      this.laneView = this.add.graphics().setDepth(-0.5);
      this.tweens.add({
        targets: this.laneView,
        alpha: { from: 1, to: 0.45 },
        duration: 900,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    }
    const cell = layout.cellSize;
    const x = layout.originX + lane * cell;
    const top = layout.originY;
    const bottom = top + board.height * cell;
    const g = this.laneView.clear().setVisible(true);
    g.fillStyle(BOSS_LANE_COLOR, 0.2).fillRect(x, top, cell, bottom - top);
    g.lineStyle(Math.max(2, cell * 0.04), BOSS_LANE_COLOR, 0.85).strokeRect(
      x,
      top,
      cell,
      bottom - top,
    );
    // Шевроны под сеткой, остриём вверх: откуда и куда он пойдёт.
    const centre = x + cell / 2;
    const half = cell * 0.26;
    g.lineStyle(Math.max(3, cell * 0.07), BOSS_LANE_COLOR, 1);
    for (let i = 0; i < 3; i++) {
      const tipY = bottom + cell * (0.12 + i * 0.26);
      g.beginPath();
      g.moveTo(centre - half, tipY + half * 0.7);
      g.lineTo(centre, tipY);
      g.lineTo(centre + half, tipY + half * 0.7);
      g.strokePath();
    }
  }

  /**
   * Фильтр арта — под его масштаб на экране, в физических пикселях
   * (shared/phaser/createGame: канвас плотнее CSS). Арт почти всегда мельче
   * родного, и NEAREST его крошил — особенно на телефоне. Плитка воды — настоящий
   * пиксель-арт и всегда крупнее родного: она остаётся NEAREST (ensureWaterTexture).
   */
  private applyFilters(layout: SceneLayout): void {
    const density = 1 / this.scale.zoom;
    const apply = (key: string, shown: number, native: number): void => {
      if (!this.textures.exists(key)) return;
      this.textures
        .get(key)
        .setFilter(
          filterFor(shown, native) === 'linear'
            ? Phaser.Textures.FilterMode.LINEAR
            : Phaser.Textures.FilterMode.NEAREST,
        );
    };
    // Картинки поля и предметы в воде — в точках картинки поля.
    const field = layout.art.width * density;
    for (const key of [BOARD_ART, CASTLE_ART, GATE_GRASS_ART, WATER_DECOR_ART])
      apply(key, field, FIELD_SIZE.width);
    if (this.atlas !== null) apply(ATLAS, layout.cellSize * density, this.atlas.cell);
  }

  private redrawWater(layout: SceneLayout): void {
    const { width, height } = this.view;
    // Пиксель воды — в масштабе картинки поля, чтобы вода и поле были одной
    // крупности; и не мельче точки экрана.
    const pixel = Math.max(1, (WATER_PIXEL * layout.art.width) / FIELD_SIZE.width);
    this.water?.setSize(width, height).setTileScale(pixel, pixel);
    // Тень — кругом от середины поля: у поля вода светлее, к краям экрана
    // уходит в глубину.
    const centreX = layout.art.x + layout.art.width / 2;
    const centreY = layout.art.y + layout.art.height / 2;
    const radius = Math.hypot(
      Math.max(centreX, width - centreX),
      Math.max(centreY, height - centreY),
    );
    this.waterShade?.setPosition(centreX, centreY).setDisplaySize(radius * 2, radius * 2);
    this.redrawDecor(layout);
  }

  /** Предметы в воде — в точках картинки поля, поэтому растут вместе с ней. */
  private redrawDecor(layout: SceneLayout): void {
    const scale = layout.art.width / FIELD_SIZE.width;
    if (scale <= 0) return;
    const placements = scatterDecor({
      area: {
        x: -layout.art.x / scale,
        y: -layout.art.y / scale,
        width: this.view.width / scale,
        height: this.view.height / scale,
      },
      field: { x: 0, y: 0, ...FIELD_SIZE },
      frames: this.decorFrames,
    });
    const tint = lightTint(this.daylight);
    placements.forEach((placement, index) => {
      let image = this.decor[index];
      if (image === undefined) {
        // Между водой и тенью: дальние камни уходят в глубину вместе с водой.
        image = this.add.image(0, 0, WATER_DECOR_ART).setOrigin(0.5, 1).setDepth(-4.5);
        this.decor.push(image);
      }
      image
        .setFrame(placement.frame)
        .setPosition(layout.art.x + placement.x * scale, layout.art.y + placement.y * scale)
        .setScale(scale)
        .setFlipX(placement.flip)
        .setTint(tint)
        .setVisible(true);
    });
    for (let index = placements.length; index < this.decor.length; index++) {
      this.decor[index]?.setVisible(false);
    }
  }

  private redrawClouds(layout: SceneLayout, board: BoardSize): void {
    const clouds = this.clouds;
    if (clouds === null) return;
    const bands = cloudBands(layout, board, clouds.cell);
    const { width, height } = this.view;
    for (const [layer, top] of [
      [clouds.back, bands.back],
      [clouds.front, bands.front],
    ] as const) {
      layer.strip
        .setPosition(0, top)
        .setSize(width, layer.rows * bands.scale)
        .setTileScale(bands.scale, bands.scale);
      // Заливка на точку заходит под полосу: иначе на стыке мелькает шов.
      const fillTop = top + layer.rows * bands.scale - 1;
      layer.fill.setPosition(0, fillTop).setSize(width, Math.max(0, height - fillTop));
    }
  }

  /**
   * Скорость задаётся временем сцены, а не делением длительностей: тогда её
   * можно переключить посреди боя, и уже запущенные твины подхватят новую.
   */
  private applySpeed(): void {
    this.time.timeScale = this.speed;
    this.tweens.timeScale = this.speed;
  }

  /**
   * Проиграть шаги хода. Домен уже всё посчитал; здесь только показ, поэтому
   * прервать его можно в любой момент — итог от этого не изменится.
   */
  playStages(stages: readonly MoveStage[]): void {
    const last = stages.at(-1);
    if (last === undefined) return;

    const generation = ++this.generation;
    this.stagesTarget = last.board;
    void this.runStages(stages, generation).then(() => {
      if (generation === this.generation) this.finishStages();
    });
  }

  /**
   * Новое поле — новый забег: плитки не появляются разом, а падают сверху и
   * заполняют поле снизу вверх. Прерывается, как и ход, — пропуском или
   * следующим ходом; итог от этого не меняется, он уже в `board`.
   */
  dealIn(board: Board): void {
    if (!this.started) {
      this.pending = board;
      this.pendingDeal = true;
      return;
    }

    const generation = ++this.generation;
    this.stagesTarget = board;
    this.setBoard(board);
    const layout = this.layout;
    if (layout === null) {
      this.finishStages();
      return;
    }

    this.dealing.clear();
    const falls = board.cells.map((_, index) => {
      const cell = { x: index % board.width, y: Math.floor(index / board.width) };
      // Сверху клетка идёт поверх цитадели: проявляется на лету, а не висит над ней.
      const state = { lift: 1, alpha: 0 };
      this.dealing.set(index, state);
      this.applyDeal(index);
      return new Promise<void>((resolve) => {
        this.tweens.add({
          targets: state,
          lift: 0,
          alpha: 1,
          delay: dealDelay(cell, board.height),
          duration: fallDuration(board.height),
          ease: 'Back.easeOut',
          onUpdate: () => this.applyDeal(index),
          onComplete: () => {
            // Последний onUpdate приходит чуть раньше конца, посреди перелёта
            // Back.easeOut: без этого клетка застряла бы на пару пикселей мимо.
            state.lift = 0;
            state.alpha = 1;
            this.applyDeal(index);
            this.dealing.delete(index);
            resolve();
          },
        });
      });
    });

    void Promise.all(falls).then(() => {
      if (generation === this.generation) this.finishStages();
    });
  }

  /** Поставить падающую клетку туда, где она сейчас в полёте. */
  private applyDeal(index: number): void {
    const state = this.dealing.get(index);
    const view = this.cellViews[index];
    const layout = this.layout;
    const board = this.board;
    if (state === undefined || view === undefined || layout === null || board === null) return;
    const centre = cellToScreen(layout, {
      x: index % board.width,
      y: Math.floor(index / board.width),
    });
    view.container.y = centre.y - state.lift * board.height * layout.cellSize;
    view.container.setAlpha(state.alpha);
  }

  /**
   * Показать поле сразу, оборвав всё, что ещё доигрывает: ход, раздачу, летящую
   * кровь. Так приходит отменённый ход — иначе недоигранная анимация в конце
   * вернула бы на экран то самое поле, которое игрок только что отменил.
   */
  showBoard(board: Board): void {
    this.generation++;
    this.stagesTarget = null;
    this.dealing.clear();
    for (const view of this.cellViews) {
      if (view !== undefined) this.tweens.killTweensOf(view.container);
    }
    this.landAllBlood();
    this.setBoard(board);
  }

  /** Пропуск: показать итог немедленно. */
  skip(): void {
    this.generation++;
    this.tweens.killAll();
    // Твин дня и ночи погиб вместе с остальными: свет встаёт сразу на место.
    this.daylightTween = null;
    this.daylight = this.daylightTarget;
    this.applyDaylight();
    this.landAllBlood();
    this.finishStages();
  }

  // ── кровь за длинный матч ───────────────────────────────────────────────

  /**
   * Над каждой длинной группой встают капли — по одной за каплю крови — и
   * летят вниз, к шкале под полем, с маленьким «+N» у первой. Каждая долетевшая
   * наливает одну каплю.
   */
  private flyBlood(groups: readonly (readonly Position[])[]): void {
    const layout = this.layout;
    if (layout === null) return;
    this.ensureDropTexture();

    for (const group of groups) {
      const amount = longMatchBonus([group.length], ECONOMY_CONFIG.longMatchFrom);
      if (amount === 0) continue;

      const points = group.map((cell) => cellToScreen(layout, cell));
      const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const size = layout.cellSize;

      for (let i = 0; i < amount; i++) {
        this.bloodUndelivered++;
        // Капли встают рядком над группой, толчком, и только потом падают к шкале.
        const startX = x + (i - (amount - 1) / 2) * size * 0.34;
        const endX = this.view.width / 2 + (i - (amount - 1) / 2) * size * 0.3;
        const endY = this.view.height - 4;
        const delay = BLOOD_LIFT_MS + i * BLOOD_STAGGER_MS;
        const drop = this.add
          .image(startX, y, BLOOD_DROP)
          .setTint(BLOOD_TINT)
          .setDepth(6)
          .setDisplaySize(size * 0.42, size * 0.52);
        // Свечение есть только в WebGL; на Canvas капля летит без него.
        drop.preFX?.addGlow(BLOOD_TINT, 4, 0, false, 0.1, 12);
        const full = drop.scale;
        drop.setScale(full * 0.2);
        this.bloodInFlight.push(drop);
        this.tweens.add({
          targets: drop,
          scale: full,
          duration: BLOOD_LIFT_MS,
          ease: 'Back.easeOut',
        });
        this.tweens.add({
          targets: drop,
          x: endX,
          y: endY,
          scale: full * 0.7,
          duration: BLOOD_FLIGHT_MS,
          delay,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.landBlood(drop);
          },
        });

        // Цифра — одна на группу, маленькая, и летит вместе с первой каплей.
        if (i === 0) {
          this.rideLabel(amount, startX, y, endX, endY, delay, size);
        }
      }
    }
  }

  private landBlood(drop: Phaser.GameObjects.GameObject): void {
    const index = this.bloodInFlight.indexOf(drop);
    if (index === -1) return;
    this.bloodInFlight.splice(index, 1);
    drop.destroy();
    this.bloodUndelivered--;
    this.bloodHandler?.(1);
  }

  /** Пропуск: всё, что летело, засчитывается сразу. */
  private landAllBlood(): void {
    for (const item of this.bloodInFlight) item.destroy();
    this.bloodInFlight = [];
    if (this.bloodUndelivered > 0) this.bloodHandler?.(this.bloodUndelivered);
    this.bloodUndelivered = 0;
  }

  /** «+N» у первой капли: те же путь и время, чуть правее и выше неё. */
  private rideLabel(
    amount: number,
    x: number,
    y: number,
    endX: number,
    endY: number,
    delay: number,
    size: number,
  ): void {
    const dx = size * 0.32;
    const dy = -size * 0.22;
    const text = this.add
      .text(x + dx, y + dy, `+${String(amount)}`, {
        fontFamily: '"Manrope Variable", system-ui, sans-serif',
        fontSize: `${String(Math.round(Math.max(11, size * 0.3)))}px`,
        fontStyle: '800',
        color: '#ffc2ca',
        stroke: '#2a0710',
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setDepth(7)
      .setAlpha(0);
    this.bloodInFlight.push(text);
    this.tweens.add({ targets: text, alpha: 1, duration: BLOOD_LIFT_MS });
    this.tweens.add({
      targets: text,
      x: endX + dx,
      y: endY + dy,
      duration: BLOOD_FLIGHT_MS,
      delay,
      ease: 'Cubic.easeIn',
    });
    this.tweens.add({
      targets: text,
      alpha: 0,
      delay: delay + BLOOD_FLIGHT_MS * 0.75,
      duration: BLOOD_FLIGHT_MS * 0.25,
      onComplete: () => {
        const index = this.bloodInFlight.indexOf(text);
        if (index !== -1) this.bloodInFlight.splice(index, 1);
        text.destroy();
      },
    });
  }

  /** Капля рисуется один раз и дальше берётся из кэша текстур. */
  private ensureDropTexture(): void {
    if (this.textures.exists(BLOOD_DROP)) return;
    const graphics = this.make.graphics({}, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(16, 27, 12);
    graphics.fillTriangle(16, 2, 4.6, 22, 27.4, 22);
    graphics.generateTexture(BLOOD_DROP, 32, 40);
    graphics.destroy();
  }

  /** Ход доигран: поле на итоге, наружу уходит «можно дальше». */
  private finishStages(): void {
    const target = this.stagesTarget;
    if (target === null) return;
    this.stagesTarget = null;
    this.dealing.clear();
    this.setBoard(target);
    this.stagesDoneHandler?.();
  }

  /**
   * Анимация хода доиграна или пропущена. Рассвет ждёт этого сигнала: иначе бой
   * начался бы посреди падения плиток.
   */
  onStagesDone(handler: () => void): void {
    this.stagesDoneHandler = handler;
  }

  /**
   * Капля долетела до шкалы. Шкала наливается по этому сигналу, а не в момент
   * хода: иначе кровь прибавлялась бы раньше, чем игрок увидит, откуда она.
   */
  onBlood(handler: (amount: number) => void): void {
    this.bloodHandler = handler;
  }

  /** Тап без свайпа — так пьют потир. Что делать с тапом, решает вызывающий. */
  onTap(handler: (at: Position) => void): void {
    this.tapHandler = handler;
  }

  /** Где на экране центр клетки — для подсказок React поверх канваса. */
  cellCentre(cell: Position): { x: number; y: number } | null {
    return this.layout === null ? null : cellToScreen(this.layout, cell);
  }

  /**
   * Ввод обрабатывает поле, а наружу уходит готовая команда. React на канвас не
   * кликает — иначе пришлось бы дублировать разбор жеста в двух местах.
   */
  onSwap(handler: (from: Position, to: Position) => void): void {
    this.swapHandler = handler;
  }

  /** Клетку тянут за край поля — в башню замка или сброс за край. */
  onEdge(handler: (from: Position, direction: Direction) => void): void {
    this.edgeHandler = handler;
  }

  /** Сколько снизу занимает подвал интерфейса: поле под него не заходит. */
  setReserveBottom(pixels: number): void {
    if (this.reserveBottom === pixels) return;
    this.reserveBottom = pixels;
    if (this.started) this.redraw();
  }

  /**
   * Пауза: реклама на экране, площадка открыла своё окно или вкладка скрыта.
   * Сцена встаёт целиком — бой, твины, таймеры, — и продолжается с того же
   * места (требование площадки 1.19.4).
   */
  setPaused(paused: boolean): void {
    this.pausedWanted = paused;
    if (!this.started) return;
    if (paused && !this.scene.isPaused()) this.scene.pause();
    if (!paused && this.scene.isPaused()) this.scene.resume();
  }

  /** Столбец босса этой ночи или null — подсветка гаснет. */
  /** Какие клетки держит постройка: подсказка при осмотре и в обучении. */
  setAttackZone(zone: AttackZoneView | null): void {
    if (this.zone === zone) return;
    this.zone = zone;
    if (this.started) this.redraw();
  }

  setBossLane(column: number | null): void {
    if (this.bossLane === column) return;
    this.bossLane = column;
    if (this.started) this.redraw();
  }

  setTurrets(turrets: readonly TurretView[]): void {
    this.turrets = turrets;
    if (this.started) this.redraw();
  }

  // ── анимация ────────────────────────────────────────────────────────────

  private async runStages(stages: readonly MoveStage[], generation: number): Promise<void> {
    let previous = this.board;

    for (const stage of stages) {
      if (generation !== this.generation) return;
      await this.runStage(previous, stage);
      previous = stage.board;
    }
  }

  private async runStage(previous: Board | null, stage: MoveStage): Promise<void> {
    const cellSize = this.layout?.cellSize ?? 0;

    if (stage.kind === 'settle') {
      this.setBoard(stage.board);
      await Promise.all(
        [...stage.fallen.entries()].map(([index, distance]) => {
          const view = this.cellViews[index];
          if (view === undefined) return Promise.resolve();
          const target = view.container.y;
          view.container.y = target - distance * cellSize;
          return this.tweenTo(
            view.container,
            { y: target },
            fallDuration(distance),
            'Back.easeOut',
          );
        }),
      );
      return;
    }

    if (stage.moved.length === 2) {
      this.audio?.play('swap');
      this.setBoard(stage.board);
      const [a, b] = stage.moved as [Position, Position];
      await Promise.all([this.slideFrom(a, b, DURATION.swap), this.slideFrom(b, a, DURATION.swap)]);
      return;
    }

    // Выпили потир: он исчезает с поля без тройки.
    if (
      stage.kind === 'action' &&
      previous !== null &&
      stage.removed.some((at) => previous.cells[at.y * previous.width + at.x]?.kind === 'potion')
    ) {
      this.audio?.play('potion');
      for (const at of stage.removed) {
        const cell = previous.cells[at.y * previous.width + at.x];
        if (cell?.kind === 'potion') this.drinkPotion(at, cell.tier);
      }
    }
    if (stage.kind === 'reap') {
      this.audio?.play('match');
      this.flyBlood(stage.groups);
    }
    if (stage.kind === 'merge') {
      this.audio?.play('merge');
      // Вспышка слияния — там, где встаёт новая ступень.
      const layout = this.layout;
      if (layout !== null) {
        for (const at of stage.appeared) {
          const centre = cellToScreen(layout, at);
          this.effectOnce(
            'fx-merge',
            centre.x,
            centre.y + layout.cellSize * 0.35,
            layout.cellSize,
            0.75,
          );
        }
      }
    }

    // Исчезновение видно только на прежнем поле: в `stage.board` этих клеток уже нет.
    if (previous !== null && stage.removed.length > 0) {
      this.setBoard(previous);
      // Тройка и слияние стягиваются в клетку, где встанет новое: иначе три
      // отдельных хлопка не читаются как одно превращение.
      const targets = gatherTargets(stage);
      await Promise.all(
        stage.removed.map((cell) => {
          const focus = targets.get(`${String(cell.x)},${String(cell.y)}`);
          return focus === undefined
            ? this.scaleTo(cell, 0, DURATION.vanish, 'Back.easeIn')
            : this.pullInto(cell, focus, DURATION.vanish);
        }),
      );
    }

    this.setBoard(stage.board);
    if (stage.appeared.length > 0) {
      // Новое рождается вспышкой: кольцо цвета ступени расходится из клетки,
      // а сама постройка выпрыгивает с перелётом.
      for (const cell of stage.appeared) this.birthBurst(cell, stage.board);
      await Promise.all(
        stage.appeared.map((cell) => this.scaleTo(cell, 1, DURATION.pop, 'Back.easeOut', 0)),
      );
    }
  }

  /**
   * Вспышка рождения постройки или потира: кольцо расходится и гаснет, искры
   * разлетаются в стороны. Искры — украшение и гаснут в низком качестве;
   * кольцо остаётся, без него превращение не читается.
   */
  private birthBurst(cell: Position, board: Board): void {
    const layout = this.layout;
    if (layout === null) return;
    const born = board.cells[cell.y * board.width + cell.x];
    const tint =
      born?.kind === 'building'
        ? TIER_TINT[born.tier]
        : born?.kind === 'potion'
          ? POTION_COLOR
          : 0xffffff;
    const { x, y } = cellToScreen(layout, cell);
    const size = layout.cellSize;

    const ring = this.add.graphics().setDepth(5).setPosition(x, y);
    ring.lineStyle(Math.max(2, size * 0.07), tint, 1);
    ring.strokeCircle(0, 0, size * 0.32);
    ring.setScale(0.5);
    this.beams.add(ring);
    this.tweens.add({
      targets: ring,
      scale: 1.6,
      alpha: 0,
      duration: BIRTH_RING_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.beams.delete(ring);
        ring.destroy();
      },
    });

    if (!this.plan.particles) return;
    this.ensureShotTexture();
    for (let i = 0; i < BIRTH_SPARKS; i++) {
      // Чётные искры чуть сдвинуты: ровная звезда выглядит механически.
      const angle = (Math.PI * 2 * i) / BIRTH_SPARKS + (i % 2) * 0.25;
      const spark = this.add
        .image(x, y, 'battle-shot')
        .setTint(tint)
        .setDepth(5)
        .setDisplaySize(size * 0.1, size * 0.1);
      this.bloodInFlight.push(spark);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * size * 0.62,
        y: y + Math.sin(angle) * size * 0.62,
        alpha: 0,
        scale: spark.scale * 0.4,
        duration: BIRTH_RING_MS,
        ease: 'Quad.easeOut',
        onComplete: () => {
          const index = this.bloodInFlight.indexOf(spark);
          if (index !== -1) this.bloodInFlight.splice(index, 1);
          spark.destroy();
        },
      });
    }
  }

  private viewAt(cell: Position): CellView | undefined {
    return this.board === null ? undefined : this.cellViews[cell.y * this.board.width + cell.x];
  }

  /** Клетка выезжает с места соседа — так читается обмен. */
  private slideFrom(target: Position, origin: Position, duration: number): Promise<void> {
    const view = this.viewAt(target);
    const layout = this.layout;
    if (view === undefined || layout === null) return Promise.resolve();

    const to = { x: view.container.x, y: view.container.y };
    view.container.x += (origin.x - target.x) * layout.cellSize;
    view.container.y += (origin.y - target.y) * layout.cellSize;
    return this.tweenTo(view.container, to, duration, 'Quad.easeOut');
  }

  /** Клетка съезжается к другой, тая на ходу: так читается слияние. */
  private pullInto(from: Position, to: Position, duration: number): Promise<void> {
    const view = this.viewAt(from);
    const layout = this.layout;
    if (view === undefined || layout === null) return Promise.resolve();

    const centre = cellToScreen(layout, to);
    return this.tweenTo(
      view.container,
      { x: centre.x, y: centre.y, scaleX: 0, scaleY: 0 },
      duration,
      'Quad.easeIn',
    );
  }

  private scaleTo(
    cell: Position,
    scale: number,
    duration: number,
    ease: string,
    from?: number,
  ): Promise<void> {
    const view = this.viewAt(cell);
    if (view === undefined) return Promise.resolve();
    if (from !== undefined) view.container.setScale(from);
    return this.tweenTo(view.container, { scaleX: scale, scaleY: scale }, duration, ease);
  }

  private tweenTo(
    target: Phaser.GameObjects.Container,
    props: Record<string, number>,
    duration: number,
    ease: string,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({
        targets: target,
        ...props,
        duration,
        ease,
        onComplete: () => resolve(),
      });
    });
  }

  // ── ввод ────────────────────────────────────────────────────────────────

  private bindInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      const board = this.board;
      const layout = this.layout;
      if (board === null || layout === null) return;

      const at = this.pointAt(pointer);
      this.dragFrom = screenToCell(layout, at, board);
      this.dragStart = at;
      this.paintHeld();
      // Держат палец на клетке, не сдвигая, — показать, что это такое. Это
      // уже не тап и не свап: отпускание после осмотра ничего не делает.
      const held = this.dragFrom;
      this.cancelHold();
      if (held !== null && this.inspectHandler !== null) {
        this.holdTimer = window.setTimeout(() => {
          this.holdTimer = null;
          if (this.dragFrom === null || this.dragFrom.x !== held.x || this.dragFrom.y !== held.y)
            return;
          this.releaseDrag();
          this.inspectHandler?.(held);
        }, HOLD_MS);
      }
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      const board = this.board;
      const from = this.dragFrom;
      const start = this.dragStart;
      if (board === null || from === null || start === null || !pointer.isDown) return;

      const direction = dragDirection(start, this.pointAt(pointer));
      if (direction === null) return;

      const to = step(from, direction);
      this.releaseDrag();
      if (to.x < 0 || to.x >= board.width || to.y < 0 || to.y >= board.height) {
        this.edgeHandler?.(from, direction);
        return;
      }
      this.swapHandler?.(from, to);
    });

    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      // Палец поднят, а свайп так и не набрал порога — это тап. После свайпа
      // сюда не дойти: свап уже сбросил `dragFrom`.
      const tapped = this.dragFrom;
      this.releaseDrag();
      if (tapped !== null) this.tapHandler?.(tapped);
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.releaseDrag();
    });
  }

  /**
   * Где палец — в CSS-пикселях сцены. Экранные `pointer.x/y` — в физических
   * пикселях канваса, а камера увеличена на его плотность.
   */
  private pointAt(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return { x: world.x, y: world.y };
  }

  private cancelHold(): void {
    if (this.holdTimer !== null) window.clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  /** Долгое нажатие на клетку — показать, что в ней. */
  onInspect(handler: (at: Position) => void): void {
    this.inspectHandler = handler;
  }

  private releaseDrag(): void {
    this.cancelHold();
    this.dragFrom = null;
    this.dragStart = null;
    this.paintHeld();
  }

  /** Подсветка клетки под пальцем: подсказка вместо текста. */
  private paintHeld(): void {
    const held = this.held;
    const layout = this.layout;
    if (held === null || layout === null) return;

    held.clear();
    const cell = this.dragFrom;
    if (cell === null) return;

    const centre = cellToScreen(layout, cell);
    const inner = layout.cellSize * (1 - CELL_GAP * 2);
    held.lineStyle(Math.max(2, layout.cellSize * 0.05), 0xffe9ee, 0.9);
    held.strokeRoundedRect(centre.x - inner / 2, centre.y - inner / 2, inner, inner, inner * 0.18);
  }

  // ── бой ─────────────────────────────────────────────────────────────────

  /**
   * Частица на месте события: пыль от попадания, вспышка гибели, огонь у ворот.
   *
   * Сверх потолка новые не заводим. Это не украшение настроек: багровая горгулья
   * бьёт пятнадцать раз в секунду, и без потолка одна ночь набивала бы сцену
   * сотнями спрайтов.
   */
  private spark(kind: SparkKind, x: number, y: number, cellSize: number): void {
    const effects = this.effects;
    if (effects === null || !this.plan.particles) return;
    if (effects.active >= this.plan.maxEffects) return;

    const look = SPARK[kind];
    const scale = (cellSize * look.size) / DOT_SIZE;
    const image = effects.acquire();
    // Пул общий со взрывом из атласа — возвращаем свой круг.
    image
      .setTexture(DOT)
      .setPosition(x, y)
      .setTint(look.color)
      .setScale(scale * 0.3)
      .setAlpha(0.9);
    image.setVisible(true);
    this.tweens.add({
      targets: image,
      scale,
      alpha: 0,
      duration: look.ms,
      ease: 'Quad.easeOut',
      onComplete: () => effects.release(image),
    });
  }

  /**
   * Заглушки на месте арта, которого нет: круг для эффектов всегда, а без
   * атласа — ещё капля врага и стена цитадели. Рисуются кодом, без картинок.
   */
  /**
   * Запасные глифы поля, если атлас не загрузился: белые фигуры, цвет —
   * тинтом. Плитки — круги, потир — ромб, постройки — у каждой своя фигура.
   */
  private ensureGlyphs(): void {
    const size = ICON_SIZE;
    const c = size / 2;
    const r = size * 0.36;
    const draw = (key: string, paint: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xffffff, 1);
      paint(graphics);
      graphics.generateTexture(key, size, size);
      graphics.destroy();
    };
    for (const key of Object.values(TILE_ICON)) draw(key, (g) => g.fillCircle(c, c, r));
    draw(POTION_ICON, (g) =>
      g.fillPoints([
        { x: c, y: c - r },
        { x: c + r, y: c },
        { x: c, y: c + r },
        { x: c - r, y: c },
      ]),
    );
    draw(BUILDING_ICON.gargoyle, (g) =>
      g.fillTriangle(c, c - r, c + r, c + r * 0.8, c - r, c + r * 0.8),
    );
    draw(BUILDING_ICON.vine, (g) => g.fillRect(c - r * 0.35, c - r, r * 0.7, r * 2));
    draw(BUILDING_ICON.mortar, (g) => g.fillRect(c - r, c - r * 0.35, r * 2, r * 0.7));
    draw(BUILDING_ICON.fogveil, (g) => g.fillRoundedRect(c - r, c - r, r * 2, r * 2, r * 0.5));
  }

  private ensurePlaceholders(): void {
    this.ensureGlyphs();
    if (!this.textures.exists(DOT)) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(DOT_SIZE / 2, DOT_SIZE / 2, DOT_SIZE / 2);
      graphics.generateTexture(DOT, DOT_SIZE, DOT_SIZE);
      graphics.destroy();
    }
  }

  /** Снаряд — точка: кадров под него в атласе нет, а форма тут ни при чём. */
  private ensureShotTexture(): void {
    if (this.textures.exists('battle-shot')) return;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(8, 8, 8);
    graphics.generateTexture('battle-shot', 16, 16);
    graphics.destroy();
  }

  /**
   * Пулы на всё, что мелькает в бою. Создавать спрайт по месту нельзя: за
   * десять секунд Рассвета их набегают сотни, и сборка мусора приходит ровно
   * тогда, когда кадры нужнее всего.
   */
  private createPools(): void {
    this.enemies = createPool(
      () => this.add.sprite(0, 0, DOT).setDepth(2).setVisible(false),
      (sprite) => {
        // Темп анимации — тоже в исходный: следующий враг из пула не в тумане.
        sprite.anims.timeScale = 1;
        sprite.stop().clearTint().setVisible(false).setAlpha(1).setScale(1);
      },
    );
    this.effects = createPool(
      () => this.add.image(0, 0, DOT).setDepth(3).setVisible(false),
      (image) => image.clearTint().setVisible(false).setAlpha(1).setScale(1),
    );
    this.flames = createPool(
      () => this.add.sprite(0, 0, DOT).setDepth(3).setVisible(false),
      (sprite) => sprite.stop().setVisible(false).setAlpha(1).setScale(1),
    );
    this.shots = createPool(
      () => this.add.image(0, 0, 'battle-shot').setDepth(3).setTint(SHOT_COLOR).setVisible(false),
      (image) => image.setVisible(false).setAlpha(1),
    );
    this.numbers = createPool(
      () =>
        this.add
          .bitmapText(0, 0, DIGIT_FONT, '')
          .setDepth(4)
          .setOrigin(0.5)
          .setTint(DAMAGE_COLOR)
          .setVisible(false),
      (text) => text.setVisible(false).setAlpha(1),
    );
  }

  /** Сообщить наружу, что бой доигран: ночь можно закрывать. */
  onBattleEnd(handler: () => void): void {
    this.battleEndHandler = handler;
  }

  /**
   * Проиграть бой по логу. Домен посчитал его целиком ещё до первой картинки,
   * поэтому показ можно оборвать в любой момент — итог от этого не изменится.
   */
  playBattle(events: readonly NightEvent[]): void {
    const board = this.board;
    if (board === null) return;

    this.stopBattle();
    const generation = ++this.battleGeneration;

    for (const cue of buildCues(events, board.height)) {
      this.battleTimers.push(
        this.time.delayedCall(cue.at, () => {
          if (generation === this.battleGeneration) this.runCue(cue);
        }),
      );
    }
  }

  /** Жизни босса на поле: выход, попадание, гибель — полоске внизу. */
  onBoss(handler: (hp: BossHp | null) => void): void {
    this.bossHandler = handler;
  }

  private bossGone(id: string): void {
    if (this.boss?.id !== id) return;
    this.boss = null;
    this.bossHandler?.(null);
  }

  /** Убрать с поля всё боевое и погасить расписание. */
  stopBattle(): void {
    this.battleGeneration++;
    if (this.boss !== null) this.bossGone(this.boss.id);
    for (const timer of this.battleTimers) timer.remove(false);
    this.battleTimers = [];
    // Покраснения ссылаются на спрайты: иначе они докрасили бы спрайт, уже
    // отданный пулом следующему врагу.
    for (const actor of this.onField.values()) {
      this.stopFlash(actor);
      this.dropHpBar(actor);
    }
    this.onField.clear();
    this.enemies?.releaseAll();
    this.effects?.releaseAll();
    this.flames?.releaseAll();
    this.shots?.releaseAll();
    this.numbers?.releaseAll();
    for (const beam of this.beams) beam.destroy();
    this.beams.clear();
  }

  /** Пропуск боя: показать итог немедленно. */
  skipBattle(): void {
    this.stopBattle();
    this.battleEndHandler?.();
  }

  private runCue(cue: BattleCue): void {
    const layout = this.layout;
    if (layout === null) return;

    switch (cue.type) {
      case 'spawn': {
        if (cue.boss) {
          this.boss = { id: cue.id, max: cue.hp };
          this.bossHandler?.({ hp: cue.hp, max: cue.hp, hit: false });
        }
        const sprite = this.enemies?.acquire();
        if (sprite === undefined) return;
        const centre = cellToScreen(layout, { x: cue.column, y: cue.row });
        let tint = 0xffffff;
        sprite.setPosition(centre.x, centre.y);
        this.effectOnce('fx-spawn', centre.x, centre.y + layout.cellSize * 0.3, layout.cellSize);
        if (this.atlas !== null) {
          sprite.setScale(layout.cellSize / this.atlas.cell);
          sprite.play(animKey(atlasAnimFor(cue.kind)));
        } else {
          const look =
            PLACEHOLDER_ENEMY[cue.kind] ??
            (PLACEHOLDER_ENEMY['hunter'] as { color: number; size: number });
          tint = look.color;
          sprite.setTexture(DOT).setTint(tint);
          sprite.setScale((layout.cellSize * look.size) / DOT_SIZE);
        }
        const found: Actor = {
          sprite,
          kind: cue.kind,
          tint,
          flash: null,
          slowed: false,
          hp: cue.hp,
          maxHp: cue.hp,
          bar: null,
          trail: 1,
          trailTween: null,
        };
        sprite.setVisible(true);
        this.onField.set(cue.id, found);
        this.spark('dust', centre.x, centre.y + layout.cellSize * 0.3, layout.cellSize);
        return;
      }

      case 'march': {
        const found = this.onField.get(cue.id);
        if (found === undefined) return;
        // Прошлый шаг мог не успеть доиграть, если таймер кадра опоздал: новый
        // ведёт от того места, где спрайт сейчас, а не наслаивается на старый.
        this.tweens.killTweensOf(found.sprite);
        this.tweens.add({
          targets: found.sprite,
          y: layout.originY + (cue.y + 0.5) * layout.cellSize,
          duration: cue.duration,
          ease: 'Linear',
        });
        return;
      }

      case 'pace': {
        const found = this.onField.get(cue.id);
        if (found === undefined) return;
        // Туман держит: враг окрашен в него и перебирает ногами вдвое медленнее —
        // видно, что его тормозит завеса.
        found.slowed = cue.slowed;
        if (found.flash === null) found.sprite.setTint(tintOf(found));
        found.sprite.anims.timeScale = cue.slowed ? SLOWED_ANIM_SCALE : 1;
        return;
      }

      case 'shot': {
        this.audio?.play('shot');
        const origin = this.shotOrigin(layout, cue.from);
        const shooter = this.shooterAt(cue.from);
        if (shooter !== null) {
          const first = cue.targets[0] === undefined ? undefined : this.onField.get(cue.targets[0]);
          const up = first === undefined ? undefined : first.sprite.y < origin.y;
          this.buildingStrike(cue.from, shooter.building, shooter.tier, up);
        }
        const frame = this.shotFrame(shooter);
        for (const targetId of cue.targets) {
          const target = this.onField.get(targetId);
          if (target === undefined) continue;
          // Мортира сама поворачивается к тому, в кого стреляет.
          if (shooter?.building === 'mortar') this.faceMortar(cue.from, target.sprite.x < origin.x);
          // Есть кадр снаряда в атласе — летит он: ядро мортиры по дуге, стрела
          // и болт прямо в цель. Нет — лоза и мортира бьют линией до цели, чтобы
          // было видно, что достают через всё поле, а горгулья — точкой.
          if (frame !== null && shooter?.building === 'mortar') {
            this.lobBall(frame, origin, target.sprite, layout.cellSize);
          } else if (frame !== null) {
            this.flyProjectile(frame, origin, target.sprite, layout.cellSize);
          } else if (shooter?.building === 'vine') {
            this.lash(origin, target.sprite, layout.cellSize);
          } else if (shooter?.building === 'mortar') {
            this.blast(origin, target.sprite, layout.cellSize);
          } else {
            this.flyShot(origin, target.sprite, layout.cellSize);
          }
        }
        return;
      }

      case 'damage': {
        const target = this.onField.get(cue.id);
        if (target === undefined) return;
        if (this.boss?.id === cue.id) {
          this.bossHandler?.({ hp: cue.hpLeft, max: this.boss.max, hit: true });
        }
        target.hp = cue.hpLeft;
        this.drawHpBar(target, layout.cellSize);
        if (cue.from !== undefined) this.hitBurst(cue.from, target, layout.cellSize);
        this.popNumber(cue.amount, target.sprite.x, target.sprite.y, layout.cellSize);
        // Как в оригинале: попадание — не пыль, а короткое покраснение врага.
        this.flashHit(target);
        return;
      }

      case 'death': {
        this.audio?.play('kill');
        this.bossGone(cue.id);
        const found = this.onField.get(cue.id);
        if (found === undefined) return;
        this.onField.delete(cue.id);
        this.stopFlash(found);
        this.dropHpBar(found);
        // Мёртвый дальше не идёт: шаг, если ещё тянется, обрывается на месте.
        this.tweens.killTweensOf(found.sprite);
        // Есть кадры гибели в атласе — враг падает ими и гаснет; нет —
        // вспышка на месте, а сам враг быстро гаснет под ней.
        const dying = animKey(found.kind === 'preacher' ? 'preacher-death' : 'hunter-death');
        if (this.atlas !== null && this.anims.exists(dying)) {
          found.sprite.anims.timeScale = 1;
          found.sprite.setTint(found.tint).play(dying);
          this.tweens.add({
            targets: found.sprite,
            alpha: 0,
            delay: DEATH_HOLD_MS,
            duration: DEATH_FADE_MS,
            ease: 'Quad.easeIn',
            onComplete: () => this.enemies?.release(found.sprite),
          });
          return;
        }
        this.deathPuff(found.sprite.x, found.sprite.y, layout.cellSize);
        this.tweens.add({
          targets: found.sprite,
          alpha: 0,
          duration: DEATH_FADE_MS,
          ease: 'Quad.easeIn',
          onComplete: () => this.enemies?.release(found.sprite),
        });
        return;
      }

      case 'leak': {
        this.audio?.play('leak');
        this.bossGone(cue.id);
        const found = this.onField.get(cue.id);
        if (found === undefined) return;
        this.onField.delete(cue.id);
        this.stopFlash(found);
        this.dropHpBar(found);
        this.tweens.killTweensOf(found.sprite);
        this.hitCitadel(layout, cue.damage, cue.heartsLeft);
        // Дошёл до ворот: сперва удар (§9), и только потом уходит за поле.
        this.flame(found.sprite.x, layout.originY, layout.cellSize);
        this.tweens.add({
          targets: found.sprite,
          y: layout.originY - layout.cellSize,
          alpha: 0,
          duration: LEAK_MS,
          delay: STRIKE_MS,
          ease: 'Quad.easeIn',
          onComplete: () => this.enemies?.release(found.sprite),
        });
        return;
      }

      case 'end':
        this.battleEndHandler?.();
        return;
    }
  }

  /** Кто стреляет из этой клетки: постройка поля или горгулья в башне замка. */
  /** Вид клетки поля или башни замка — чей значок анимировать. */
  private shooterView(cell: Position): CellView | null {
    const board = this.board;
    if (board === null) return null;
    const inside = cell.x >= 0 && cell.x < board.width && cell.y >= 0 && cell.y < board.height;
    if (inside) return this.cellViews[cell.y * board.width + cell.x] ?? null;
    const index = this.turrets.findIndex(
      (turret) => turret.at.x === cell.x && turret.at.y === cell.y,
    );
    return index < 0 ? null : (this.turretViews[index] ?? null);
  }

  /**
   * Постройка стреляет — своими кадрами атласа: горгулья раскрывает крылья и
   * плюёт (`gargoyle-<ступень>-attack-1…3`), лоза разевает пасть
   * (`vine-…-attack-1…2`), мортира отдаёт стволом назад (`mortar-…-fire`) и
   * вспыхивает у дула. Пока атака идёт, новая не начинается: Багровая бьёт
   * пятнадцать раз в секунду, и без этого значок бы мерцал.
   */
  private buildingStrike(cell: Position, building: BuildingId, tier: Tier, up?: boolean): void {
    if (this.atlas === null) return;
    const view = this.shooterView(cell);
    if (view === null || this.striking.has(view)) return;
    const texture = this.textures.get(ATLAS);
    const idle = `${building}-${tier}`;
    // Лоза бьёт по столбцу: кадры атаки вверх или вниз — по тому, где цель
    // (третий прогон); нет их — общие кадры атаки.
    const vertical = up === undefined ? null : `${idle}-attack-${up ? 'up' : 'down'}`;
    const frames =
      building === 'mortar'
        ? [`mortar-${tier}-fire`]
        : vertical !== null && texture.has(`${vertical}-1`)
          ? [1, 2].map((index) => `${vertical}-${String(index)}`)
          : [1, 2, 3].map((index) => `${idle}-attack-${String(index)}`);
    const present = frames.filter((frame) => texture.has(frame));
    if (present.length === 0) return;
    this.striking.add(view);
    const step = building === 'mortar' ? MORTAR_RECOIL_MS : STRIKE_FRAME_MS;
    const own = (): boolean => view.icon.frame.name.startsWith(`${building}-`);
    present.forEach((frame, index) => {
      this.time.delayedCall(index * step, () => {
        if (own()) view.icon.setFrame(frame);
      });
    });
    if (building === 'mortar') this.muzzleFlash(view, tier);
    this.time.delayedCall(present.length * step, () => {
      this.striking.delete(view);
      if (own()) view.icon.setFrame(idle);
    });
  }

  /** Вспышка у дула мортиры — с той стороны, куда она повёрнута. */
  private muzzleFlash(view: CellView, tier: Tier): void {
    const layout = this.layout;
    const frame = `mortar-${tier}-flash`;
    if (this.atlas === null || layout === null || !this.textures.get(ATLAS).has(frame)) return;
    const icon = view.icon;
    const left = icon.flipX;
    const x = view.container.x + (left ? -1 : 1) * layout.cellSize * 0.55;
    const y = view.container.y + icon.y - icon.displayHeight * 0.62;
    const flash = this.add
      .image(x, y, ATLAS, frame)
      .setScale((layout.cellSize / this.atlas.cell) * 0.55)
      .setFlipX(left)
      .setDepth(3);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: flash.scale * 1.4,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Потир выпили: кубок наклоняется и пустеет, из него брызжет кровь — кадры
   * `potion-<ступень>-drink-1…3` и `fx-drink-1…4` поверх клетки, которой уже
   * нет на поле.
   */
  private drinkPotion(cell: Position, tier: Tier): void {
    const layout = this.layout;
    if (this.atlas === null || layout === null) return;
    const texture = this.textures.get(ATLAS);
    const frames = [
      ...[1, 2, 3].map((index) => `potion-${tier}-drink-${String(index)}`),
      ...[1, 2, 3, 4].map((index) => `fx-drink-${String(index)}`),
    ].filter((frame) => texture.has(frame));
    if (frames.length === 0) return;
    const centre = cellToScreen(layout, cell);
    const image = this.add
      .image(centre.x, centre.y + layout.cellSize / 2, ATLAS, frames[0])
      .setOrigin(0.5, 1)
      .setScale(layout.cellSize / this.atlas.cell)
      .setDepth(1.5);
    frames.forEach((frame, index) => {
      this.time.delayedCall(index * DRINK_FRAME_MS, () => image.setFrame(frame));
    });
    this.time.delayedCall(frames.length * DRINK_FRAME_MS, () => image.destroy());
  }

  /** Повернуть мортиру на поле к цели: влево или вправо. */
  private faceMortar(cell: Position, left: boolean): void {
    const board = this.board;
    if (board === null || cell.x < 0 || cell.x >= board.width || cell.y < 0) return;
    if (cell.y >= board.height) return;
    // Кадр атласа нарисован стволом вправо: влево — отражение.
    this.cellViews[cell.y * board.width + cell.x]?.icon.setFlipX(left);
  }

  private shooterAt(cell: Position): BuildingCell | null {
    const board = this.board;
    if (board === null) return null;
    const inside = cell.x >= 0 && cell.x < board.width && cell.y >= 0 && cell.y < board.height;
    const found = inside
      ? board.cells[cell.y * board.width + cell.x]
      : this.turrets.find((turret) => turret.at.x === cell.x && turret.at.y === cell.y)?.cell;
    return found?.kind === 'building' ? found : null;
  }

  /** Кадр снаряда из атласа. null — атласа нет или снаряда в нём нет. */
  private shotFrame(shooter: BuildingCell | null): string | null {
    if (this.atlas === null || shooter === null) return null;
    const frame = shotFrameFor(shooter.building, shooter.tier);
    return frame !== null && this.textures.get(ATLAS).has(frame) ? frame : null;
  }

  /** Сколько летит снаряд: в оригинале — 4,8 клетки в секунду. */
  private flightMs(
    from: { x: number; y: number },
    to: { x: number; y: number },
    cellSize: number,
  ): number {
    const cells = Math.hypot(to.x - from.x, to.y - from.y) / cellSize;
    return Math.min(SHOT_MAX_MS, Math.max(SHOT_MIN_MS, (cells / SHOT_CELLS_PER_SECOND) * 1000));
  }

  /**
   * Стрела горгульи, болт лозы: кадр нарисован остриём вниз и поворачивается
   * по полёту. Летит в цель с доводкой — цель тем временем движется.
   */
  private flyProjectile(
    frame: string,
    origin: { x: number; y: number },
    target: Phaser.GameObjects.Sprite,
    cellSize: number,
  ): void {
    const shot = this.shots?.acquire();
    if (shot === undefined || this.atlas === null) return;

    shot
      .setTexture(ATLAS, frame)
      .clearTint()
      .setScale(cellSize / this.atlas.cell);
    shot.setPosition(origin.x, origin.y).setVisible(true);
    const flight = { progress: 0 };
    this.tweens.add({
      targets: flight,
      progress: 1,
      duration: this.flightMs(origin, target, cellSize),
      ease: 'Linear',
      onUpdate: () => {
        const x = origin.x + (target.x - origin.x) * flight.progress;
        const y = origin.y + (target.y - origin.y) * flight.progress;
        // Остриё нарисовано вниз: полёт вниз — без поворота.
        shot.setRotation(Math.atan2(target.y - shot.y, target.x - shot.x) - Math.PI / 2);
        shot.setPosition(x, y);
      },
      onComplete: () => this.shots?.release(shot),
    });
  }

  /**
   * Ядро мортиры: по дуге вдоль ряда, тень скользит по земле, в цели — взрыв.
   * Высота дуги — как в оригинале: 10 точек плюс девятая часть дальности, в
   * точках атласа.
   */
  private lobBall(
    frame: string,
    origin: { x: number; y: number },
    target: Phaser.GameObjects.Sprite,
    cellSize: number,
  ): void {
    const ball = this.shots?.acquire();
    if (ball === undefined || this.atlas === null) return;
    const scale = cellSize / this.atlas.cell;
    const shadow = this.textures.get(ATLAS).has('shot-shadow') ? this.shots?.acquire() : undefined;

    ball.setTexture(ATLAS, frame).clearTint().setScale(scale).setRotation(0).setVisible(true);
    shadow?.setTexture(ATLAS, 'shot-shadow').clearTint().setScale(scale).setRotation(0);
    shadow?.setAlpha(0.6).setVisible(true);

    const end = { x: target.x, y: target.y };
    // В точках атласа: 10 + дальность / 9; на экран — умножить на масштаб.
    const height = (10 + Math.abs(end.x - origin.x) / scale / 9) * scale;
    const flight = { progress: 0 };
    this.tweens.add({
      targets: flight,
      progress: 1,
      duration: this.flightMs(origin, end, cellSize),
      ease: 'Linear',
      onUpdate: () => {
        const x = origin.x + (end.x - origin.x) * flight.progress;
        const y = origin.y + (end.y - origin.y) * flight.progress;
        shadow?.setPosition(x, y);
        ball.setPosition(x, y - Math.sin(flight.progress * Math.PI) * height);
      },
      onComplete: () => {
        this.shots?.release(ball);
        if (shadow !== undefined) this.shots?.release(shadow);
        this.explode(end.x, end.y, cellSize);
      },
    });
  }

  /**
   * Покраснение от попадания. Новое попадание перезапускает его с начала: у
   * багровой горгульи попадания идут чаще, чем гаснет покраснение.
   */
  private flashHit(actor: Actor): void {
    this.stopFlash(actor);
    const flash = { progress: 0 };
    actor.flash = this.tweens.add({
      targets: flash,
      progress: 1,
      duration: HIT_FLASH_MS,
      ease: 'Linear',
      onUpdate: () => actor.sprite.setTint(hitFlashTint(flash.progress, tintOf(actor))),
      onComplete: () => {
        actor.flash = null;
        actor.sprite.setTint(tintOf(actor));
      },
    });
  }

  /**
   * Полоска жизней над врагом — после первого попадания: целых не
   * помечаем, иначе свежая колонна рябит десятками полосок. Капсула с рамкой и
   * бликом; снятое попаданием сперва остаётся бледным следом и стекает.
   */
  private drawHpBar(actor: Actor, cellSize: number): void {
    if (actor.maxHp <= 0) return;
    const share = Math.max(0, Math.min(1, actor.hp / actor.maxHp));
    if (share >= 1) return;
    if (actor.bar === null) {
      actor.bar = this.add.graphics().setDepth(2.5).setAlpha(0);
      this.tweens.add({ targets: actor.bar, alpha: 1, duration: 140 });
    }
    actor.trailTween?.remove();
    const trail = { value: actor.trail };
    actor.trailTween = this.tweens.add({
      targets: trail,
      value: share,
      delay: HP_TRAIL_DELAY_MS,
      duration: HP_TRAIL_MS,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        actor.trail = trail.value;
        this.paintHpBar(actor, cellSize);
      },
    });
    this.paintHpBar(actor, cellSize);
  }

  private paintHpBar(actor: Actor, cellSize: number): void {
    const bar = actor.bar;
    if (bar === null) return;
    const share = Math.max(0, Math.min(1, actor.hp / actor.maxHp));
    const width = cellSize * HP_BAR_WIDTH;
    const height = Math.max(4, Math.round(cellSize * 0.075));
    const radius = height / 2;
    const left = -width / 2;
    const top = -height / 2;
    bar.clear();
    // Рамка: тёмная подложка и тонкий светлый ободок — читается и на тёмном
    // поле, и на светлой завесе.
    bar
      .fillStyle(0x0a0410, 0.9)
      .fillRoundedRect(left - 1.5, top - 1.5, width + 3, height + 3, radius + 1.5);
    bar
      .lineStyle(1, 0x5a3a4c, 0.9)
      .strokeRoundedRect(left - 1.5, top - 1.5, width + 3, height + 3, radius + 1.5);
    // След урона — бледный, стекает к нынешним жизням.
    const trailWidth = width * Math.max(share, actor.trail);
    if (trailWidth > width * share + 0.5) {
      bar.fillStyle(0xffd6dc, 0.85).fillRoundedRect(left, top, trailWidth, height, radius);
    }
    // Сами жизни: цвет по остатку, сверху блик.
    const fill = width * share;
    if (fill > 0.5) {
      const color = share > 0.6 ? HP_BAR_FULL : share > 0.3 ? HP_BAR_MID : HP_BAR_LOW;
      const r = Math.min(radius, fill / 2);
      bar.fillStyle(color, 1).fillRoundedRect(left, top, fill, height, r);
      bar
        .fillStyle(0xffffff, 0.32)
        .fillRoundedRect(left + 1, top + 0.5, Math.max(0, fill - 2), height * 0.38, {
          tl: r,
          tr: r,
          bl: 0,
          br: 0,
        });
    }
  }

  private dropHpBar(actor: Actor): void {
    actor.trailTween?.remove();
    actor.trailTween = null;
    actor.bar?.destroy();
    actor.bar = null;
  }

  /**
   * Враг ударил по цитадели: замок вспыхивает алым, экран вздрагивает, над
   * воротами всплывает «−1 ♥», а шапке уходит новое число сердец.
   */
  private hitCitadel(layout: SceneLayout, damage: number, heartsLeft: number): void {
    this.heartsHandler?.(heartsLeft);
    this.cameras.main.shake(CITADEL_SHAKE_MS, CITADEL_SHAKE);
    const castle = this.citadelArt;
    if (castle !== null) {
      this.tweens.killTweensOf(castle);
      const pulse = { red: 1 };
      this.tweens.add({
        targets: pulse,
        red: 0,
        duration: CITADEL_FLASH_MS,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          castle.setTint(mixTint(lightTint(this.daylight), CITADEL_HIT_TINT, pulse.red));
        },
        onComplete: () => {
          castle.setTint(lightTint(this.daylight));
        },
      });
    }
    const gate = artToScreen(layout, FIELD_SIZE, CITADEL_GATE);
    const label = this.add
      .text(gate.x, gate.y, `−${String(damage)} ♥`, {
        fontFamily: 'Manrope Variable, sans-serif',
        fontSize: `${String(Math.round(layout.cellSize * 0.42))}px`,
        fontStyle: '800',
        color: '#ff4d64',
        stroke: '#1a0710',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(7);
    this.tweens.add({
      targets: label,
      y: gate.y - layout.cellSize * 0.9,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /** Число сердец меняется в бою — шапке. */
  onHearts(handler: (hearts: number) => void): void {
    this.heartsHandler = handler;
  }

  /** Оборвать покраснение и вернуть врагу свой цвет. */
  private stopFlash(actor: Actor): void {
    if (actor.flash === null) return;
    actor.flash.remove();
    actor.flash = null;
    actor.sprite.setTint(tintOf(actor));
  }

  /**
   * Гибель врага: облачко атласа крутится, чуть растёт и гаснет — как в
   * оригинале. Нет кадра — вспышка-круг.
   */
  private deathPuff(x: number, y: number, cellSize: number): void {
    if (this.atlas === null || !this.textures.get(ATLAS).has('fx-death')) {
      this.spark('burst', x, y, cellSize);
      return;
    }
    const effects = this.effects;
    if (effects === null || effects.active >= this.plan.maxEffects) return;
    const scale = cellSize / this.atlas.cell;
    const image = effects.acquire();
    image.setTexture(ATLAS, 'fx-death').clearTint().setPosition(x, y).setRotation(0);
    image.setScale(scale).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: image,
      scale: scale * 1.3,
      rotation: Math.PI,
      alpha: 0,
      duration: DEATH_PUFF_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        image.setRotation(0);
        effects.release(image);
      },
    });
  }

  /**
   * Пламя: анимация атласа один раз, основанием на точке — у ворот, когда враг
   * бьёт цитадель, и там, где лопнуло ядро. Нет анимации — огненный круг.
   */
  /**
   * Вспышка попадания — своя у каждой постройки: осколки камня горгульи,
   * алые щепки шипов лозы, пепел и огонь ядра мортиры (`hit-<вид>-1…`).
   * Кадры сменяются вручную, без анимации Phaser: их число у видов разное.
   */
  private hitBurst(from: Position, target: Actor, cellSize: number): void {
    const shooter = this.shooterAt(from);
    if (this.atlas === null || shooter === null || !this.plan.particles) return;
    const texture = this.textures.get(ATLAS);
    const frames: string[] = [];
    for (let index = 1; texture.has(`hit-${shooter.building}-${String(index)}`); index++) {
      frames.push(`hit-${shooter.building}-${String(index)}`);
    }
    const effects = this.effects;
    if (frames.length === 0 || effects === null || effects.active >= this.plan.maxEffects) return;
    const image = effects.acquire();
    image
      .setTexture(ATLAS, frames[0])
      .clearTint()
      .setPosition(target.sprite.x, target.sprite.y - cellSize * 0.1)
      .setScale(cellSize / this.atlas.cell)
      .setRotation(0)
      .setAlpha(1)
      .setVisible(true);
    // Бой оборвали (пропуск, новый забег) — пул уже отдал картинку другому.
    const generation = this.battleGeneration;
    const alive = (): boolean => generation === this.battleGeneration;
    frames.forEach((frame, index) => {
      this.time.delayedCall(index * HIT_FRAME_MS, () => {
        if (alive()) image.setFrame(frame);
      });
    });
    this.time.delayedCall(frames.length * HIT_FRAME_MS, () => {
      if (alive()) effects.release(image);
    });
  }

  /**
   * Эффект атласа один раз: вспышка слияния (`fx-merge`), пыль выхода врага
   * (`fx-spawn`). Нет анимации в атласе или частицы выключены — ничего.
   */
  private effectOnce(name: string, x: number, y: number, cellSize: number, originY = 1): void {
    const key = animKey(name);
    const flames = this.flames;
    if (this.atlas === null || !this.anims.exists(key) || flames === null) return;
    if (!this.plan.particles || flames.active >= this.plan.maxEffects) return;
    const sprite = flames.acquire();
    sprite
      .setOrigin(0.5, originY)
      .setPosition(x, y)
      .setScale(cellSize / this.atlas.cell)
      .setDepth(3);
    sprite.setVisible(true).play(key);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flames.release(sprite));
  }

  private flame(x: number, y: number, cellSize: number): void {
    const key = animKey('fx-fire');
    if (this.atlas === null || !this.anims.exists(key)) {
      this.spark('fire', x, y, cellSize);
      return;
    }
    const flames = this.flames;
    if (flames === null || !this.plan.particles || flames.active >= this.plan.maxEffects) return;
    const sprite = flames.acquire();
    sprite
      .setOrigin(0.5, 1)
      .setPosition(x, y)
      .setScale(cellSize / this.atlas.cell);
    sprite.setVisible(true).play(key);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flames.release(sprite));
  }

  /** Взрыв ядра: кадр атласа растёт и гаснет. Нет кадра — пламя или вспышка. */
  private explode(x: number, y: number, cellSize: number): void {
    if (this.atlas === null || !this.textures.get(ATLAS).has('shot-explosion')) {
      this.flame(x, y, cellSize);
      return;
    }
    const effects = this.effects;
    if (effects === null || effects.active >= this.plan.maxEffects) return;
    const scale = (cellSize / this.atlas.cell) * EXPLOSION_SCALE;
    const image = effects.acquire();
    image.setTexture(ATLAS, 'shot-explosion').clearTint().setPosition(x, y);
    image
      .setScale(scale * 0.2)
      .setAlpha(1)
      .setVisible(true);
    this.tweens.add({
      targets: image,
      scale,
      alpha: 0,
      duration: EXPLOSION_MS,
      ease: 'Quad.easeOut',
      onComplete: () => effects.release(image),
    });
  }

  /**
   * Хлыст лозы: вдоль столбца от постройки до цели, с шипами. Вспыхивает и
   * гаснет — между выстрелами линия не висит.
   */
  private lash(
    origin: { x: number; y: number },
    target: Phaser.GameObjects.Sprite,
    cellSize: number,
  ): void {
    const end = { x: origin.x, y: target.y };
    const beam = this.add.graphics().setDepth(4);
    beam.lineStyle(cellSize * 0.22, LASH_COLOR, 0.25);
    beam.lineBetween(origin.x, origin.y, end.x, end.y);
    beam.lineStyle(Math.max(2, cellSize * 0.06), LASH_CORE, 1);
    beam.lineBetween(origin.x, origin.y, end.x, end.y);

    // Шипы — короткие косые штрихи вдоль хлыста, через одинаковый шаг.
    const length = Math.abs(end.y - origin.y);
    const direction = Math.sign(end.y - origin.y) || 1;
    const spike = cellSize * 0.12;
    beam.lineStyle(Math.max(1.5, cellSize * 0.035), LASH_COLOR, 1);
    for (let d = cellSize * 0.35; d < length; d += cellSize * 0.3) {
      const y = origin.y + d * direction;
      const side = Math.round(d / (cellSize * 0.3)) % 2 === 0 ? 1 : -1;
      beam.lineBetween(end.x, y, end.x + spike * side, y - spike * direction);
    }
    this.fadeBeam(beam, LASH_MS);
  }

  /** Залп мортиры: огненная полоса вдоль ряда до цели и вспышка на ней. */
  private blast(
    origin: { x: number; y: number },
    target: Phaser.GameObjects.Sprite,
    cellSize: number,
  ): void {
    const end = { x: target.x, y: origin.y };
    const beam = this.add.graphics().setDepth(4);
    beam.lineStyle(cellSize * 0.38, BLAST_COLOR, 0.22);
    beam.lineBetween(origin.x, origin.y, end.x, end.y);
    beam.lineStyle(cellSize * 0.16, BLAST_COLOR, 0.7);
    beam.lineBetween(origin.x, origin.y, end.x, end.y);
    beam.lineStyle(Math.max(2, cellSize * 0.05), BLAST_CORE, 1);
    beam.lineBetween(origin.x, origin.y, end.x, end.y);
    this.fadeBeam(beam, BLAST_MS);
    this.flame(end.x, end.y, cellSize);
  }

  private fadeBeam(beam: Phaser.GameObjects.Graphics, duration: number): void {
    this.beams.add(beam);
    this.tweens.add({
      targets: beam,
      alpha: 0,
      duration,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.beams.delete(beam);
        beam.destroy();
      },
    });
  }

  private flyShot(
    origin: { x: number; y: number },
    target: Phaser.GameObjects.Image,
    cellSize: number,
  ): void {
    const shot = this.shots?.acquire();
    if (shot === undefined) return;

    // Пул общий со снарядами атласа — возвращаем точку и её цвет.
    shot.setTexture('battle-shot').setTint(SHOT_COLOR).setRotation(0);
    shot.setPosition(origin.x, origin.y);
    shot.setDisplaySize(cellSize * 0.16, cellSize * 0.16);
    shot.setVisible(true);
    this.tweens.add({
      targets: shot,
      x: target.x,
      y: target.y,
      duration: 140,
      ease: 'Quad.easeIn',
      onComplete: () => this.shots?.release(shot),
    });
  }

  private popNumber(amount: number, x: number, y: number, cellSize: number): void {
    const text = this.numbers?.acquire();
    if (text === undefined) return;

    text.setText(String(Math.round(amount)));
    text.setFontSize(Math.max(12, cellSize * 0.32));
    text.setPosition(x, y - cellSize * 0.2);
    text.setVisible(true);
    this.tweens.add({
      targets: text,
      y: y - cellSize * 0.75,
      alpha: 0,
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => this.numbers?.release(text),
    });
  }

  // ── отрисовка ───────────────────────────────────────────────────────────

  private viewFor(index: number, views: CellView[] = this.cellViews): CellView {
    const existing = views[index];
    if (existing !== undefined) return existing;

    const plate = this.add.graphics();
    const icon = this.add.image(0, 0, TILE_ICON.stone);
    const pips = this.add.graphics();
    const created: CellView = {
      container: this.add.container(0, 0, [plate, icon, pips]),
      plate,
      icon,
      pips,
    };
    views[index] = created;
    return created;
  }

  /**
   * Где на экране стоит горгулья башни замка: на площадке своей круглой башни.
   * Клетка над полем — только для боя; рисуем её там, где башня на картинке.
   */
  private turretScreen(layout: SceneLayout, at: Position): { x: number; y: number } {
    const board = this.board;
    const left = board === null || at.x < board.width / 2;
    return artToScreen(layout, FIELD_SIZE, left ? TURRET_SPOTS.left : TURRET_SPOTS.right);
  }

  /** Откуда вылетает выстрел: из клетки поля или с площадки башни замка. */
  private shotOrigin(layout: SceneLayout, from: Position): { x: number; y: number } {
    const board = this.board;
    const inside = board !== null && from.y >= 0 && from.y < board.height;
    if (inside) return cellToScreen(layout, from);
    const spot = this.turretScreen(layout, from);
    return { x: spot.x, y: spot.y - layout.cellSize * 0.4 };
  }

  /** Башни замка — горгульи на площадках круглых башен. */
  private redrawTurrets(layout: SceneLayout): void {
    this.turrets.forEach((turret, index) => {
      const view = this.viewFor(index, this.turretViews);
      // Кадр стоит низом на точке площадки: центр вида — на полклетки выше.
      const spot = this.turretScreen(layout, turret.at);
      const centre = { x: spot.x, y: spot.y - layout.cellSize / 2 };
      view.container.setPosition(centre.x, centre.y).setScale(1).setAlpha(1).setVisible(true);
      this.paint(view, turret.cell, layout.cellSize);
    });
    for (let index = this.turrets.length; index < this.turretViews.length; index++) {
      this.turretViews[index]?.container.setVisible(false);
    }
  }

  /**
   * Экран в CSS-пикселях — в них сцена и считает. Канвас плотнее в
   * `1 / scale.zoom` раз (shared/phaser/createGame), и камера увеличена на ту
   * же плотность: арт рисуется в физических пикселях, а раскладка и интерфейс
   * поверх живут в CSS.
   */
  private get view(): { readonly width: number; readonly height: number } {
    const zoom = this.scale.zoom;
    return { width: this.scale.width * zoom, height: this.scale.height * zoom };
  }

  private redraw(): void {
    const board = this.board;
    if (board === null) return;

    this.cameras.main.setOrigin(0, 0).setZoom(1 / this.scale.zoom);
    const layout = computeSceneLayout({
      viewport: this.view,
      board,
      art: { ...FIELD_SIZE, inset: BOARD_GRID_INSET },
      reserveBottom: this.reserveBottom,
    });
    const moved =
      this.layout === null ||
      this.layout.cellSize !== layout.cellSize ||
      this.layout.originX !== layout.originX ||
      this.layout.originY !== layout.originY;
    this.layout = layout;
    if (moved) this.layoutHandler?.(layout);

    this.boardArt?.setPosition(layout.art.x, layout.art.y);
    this.boardArt?.setDisplaySize(layout.art.width, layout.art.height);
    this.applyFilters(layout);
    this.redrawWater(layout);
    this.redrawClouds(layout, board);
    // Замок и трава — по пикселям картинки поля, в её масштабе.
    const scale = layout.art.width / FIELD_SIZE.width;
    for (const [image, layer] of [
      [this.citadelArt, CASTLE_LAYER],
      [this.gateGrassArt, GATE_GRASS_LAYER],
    ] as const) {
      if (image === null) continue;
      const at = artToScreen(layout, FIELD_SIZE, layer);
      image.setPosition(at.x, at.y);
      image.setDisplaySize(
        image.frame.width * layer.scale * scale,
        image.frame.height * layer.scale * scale,
      );
    }

    board.cells.forEach((cell, index) => {
      const view = this.viewFor(index);
      const centre = cellToScreen(layout, {
        x: index % board.width,
        y: Math.floor(index / board.width),
      });
      view.container.setPosition(centre.x, centre.y);
      view.container.setScale(1);
      view.container.setAlpha(1);
      view.container.setVisible(true);
      this.paint(view, cell, layout.cellSize, facesLeft(cell, index % board.width, board.width));
      this.applyDeal(index);
    });

    // Лишние виды из прошлого, большего поля прячем, а не уничтожаем.
    for (let index = board.cells.length; index < this.cellViews.length; index++) {
      this.cellViews[index]?.container.setVisible(false);
    }

    this.redrawTurrets(layout);
    this.redrawBossLane(layout, board);
    this.redrawAttackZone(layout);

    // Подсветка рисуется последней, поверх клеток.
    this.held?.setDepth(1);
    this.paintHeld();
  }

  private paint(view: CellView, cell: Cell, size: number, mirrored = false): void {
    // Подложки у клетки нет: сетка уже нарисована на помосте.
    const inner = size * (1 - CELL_GAP * 2);
    const half = inner / 2;
    view.pips.clear();
    view.plate.clear();
    // Мортира, смотрящая влево, рисуется зеркально — как пушка в оригинале.
    view.icon.setFlipX(mirrored);

    if (cell.kind === 'empty') {
      view.icon.setVisible(false);
      return;
    }

    view.icon.setVisible(true);

    if (this.atlas !== null) {
      // Кадр атласа нарисован под его клетку и стоит на её нижнем краю:
      // высокие башни торчат вверх, на клетку выше (docs/atlas.md).
      view.icon.setTexture(ATLAS, atlasFrameFor(cell) ?? undefined);
      view.icon.clearTint();
      view.icon.setOrigin(0.5, 1);
      view.icon.setScale(size / this.atlas.cell);
      view.icon.setY(size / 2);
      return;
    }

    // Подъём глифа — только у постройки. Сбрасываем до ветвей: плитка, упавшая
    // в клетку, где стояла постройка, иначе так и висела бы выше соседей.
    view.icon.setY(0);

    if (cell.kind === 'tile') {
      view.icon.setTexture(TILE_ICON[cell.resource]);
      view.icon.setTint(TILE_COLOR[cell.resource]);
      view.icon.setDisplaySize(inner * ICON_FRACTION, inner * ICON_FRACTION);
      return;
    }

    if (cell.kind === 'potion') {
      view.icon.setTexture(POTION_ICON);
      view.icon.setTint(POTION_COLOR);
      view.icon.setDisplaySize(inner * ICON_FRACTION, inner * ICON_FRACTION);
    } else {
      // Постройка — глиф вида в цвете ступени, на тёмной плашке с рамкой того
      // же цвета: сырую плитку с постройкой не спутать даже краем глаза.
      const tint = TIER_TINT[cell.tier];
      paintPlate(view.plate, half, tint);
      view.icon.setTexture(BUILDING_ICON[cell.building]);
      view.icon.setTint(tint);
      view.icon.setDisplaySize(inner * BUILDING_FRACTION, inner * BUILDING_FRACTION);
      view.icon.setY(-half * 0.08);
    }

    // Точки оставляем: на маленьком экране цвет ступени читается не сразу, а
    // ошибиться ступенью перед боссом дорого.
    paintTierPips(view.pips, TIERS.indexOf(cell.tier), half);
  }
}

/** Плашка постройки: тёмный скруглённый квадрат, рамка — цветом ступени. */
function paintPlate(plate: Phaser.GameObjects.Graphics, half: number, tint: number): void {
  const side = half * 2;
  const radius = half * 0.28;
  plate.fillStyle(0x140a18, 0.82);
  plate.fillRoundedRect(-half, -half, side, side, radius);
  plate.lineStyle(Math.max(1.5, half * 0.07), tint, 0.85);
  plate.strokeRoundedRect(-half, -half, side, side, radius);
}

/** Ступень — точками, а не цифрой: надписей в канвасе не держим. */
function paintTierPips(pips: Phaser.GameObjects.Graphics, tier: number, half: number): void {
  const count = tier + 1;
  const radius = half * 0.09;
  const gap = radius * 2.6;
  const start = -((count - 1) * gap) / 2;
  pips.fillStyle(TIER_PIP[tier] ?? 0xffffff, 1);
  for (let i = 0; i < count; i++) {
    pips.fillCircle(start + i * gap, half * 0.82, radius);
  }
}

/**
 * Мортира смотрит влево — рисуем зеркально. Как в бою: развёрнутая тапом — куда
 * развернули, иначе у двух правых столбцов — влево.
 */
function facesLeft(cell: Cell, x: number, width: number): boolean {
  if (cell.kind !== 'building' || cell.building !== 'mortar') return false;
  return (cell.facing ?? (x >= width - 2 ? 'left' : 'right')) === 'left';
}

/**
 * Полоса облаков кодом, пока в атласе нет своей: бугры разной высоты и
 * величины по верху, сплошное тело ниже. Бугры идут по кругу — полоса
 * повторяется по ширине без шва. Разброс — от сида, без Math.random:
 * облака не должны меняться от перезагрузки.
 */
function drawCloudStrip(
  scene: Phaser.Scene,
  style: (typeof DRAWN_CLOUDS)[keyof typeof DRAWN_CLOUDS],
): string {
  if (scene.textures.exists(style.key)) return style.key;
  const width = DRAWN_CLOUD_WIDTH;
  const body = Math.round(style.height * style.top);
  // Хеш-шум: соседние бугры не должны выходить похожими.
  const noise = (index: number, salt: number): number => {
    const value = Math.sin(index * 12.9898 + salt * 78.233 + style.seed * 37.719) * 43758.5453;
    return value - Math.floor(value);
  };
  const puffs = Array.from({ length: 16 }, (_, index) => ({
    x: (index * width) / 16 + noise(index, 1) * 20,
    radius: 14 + noise(index, 2) * 24,
    lift: noise(index, 3) * 30,
  }));
  const graphics = scene.make.graphics({}, false);
  // Тень — те же бугры чуть выше, из-под тела она выглядывает каймой.
  for (const [color, edge] of [
    [style.shade, 3],
    [style.body, 0],
  ] as const) {
    graphics.fillStyle(color);
    for (const puff of puffs) {
      for (const shift of [-width, 0, width]) {
        graphics.fillCircle(
          puff.x + shift,
          body - puff.lift + puff.radius * 0.5 - edge,
          puff.radius,
        );
      }
    }
  }
  graphics.fillRect(0, body + 10, width, style.height);
  graphics.generateTexture(style.key, width, style.height);
  graphics.destroy();
  return style.key;
}

/** Плитка воды из water.ts — в текстуру, пиксель в пиксель, без сглаживания. */
function ensureWaterTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(WATER_TEXTURE)) return WATER_TEXTURE;
  const pixels = waterTile();
  const size = Math.round(Math.sqrt(pixels.length));
  const texture = scene.textures.createCanvas(WATER_TEXTURE, size, size);
  if (texture === null) return WATER_TEXTURE;
  const image = texture.context.createImageData(size, size);
  pixels.forEach((color, index) => {
    image.data[index * 4] = (color >> 16) & 0xff;
    image.data[index * 4 + 1] = (color >> 8) & 0xff;
    image.data[index * 4 + 2] = color & 0xff;
    image.data[index * 4 + 3] = 0xff;
  });
  texture.context.putImageData(image, 0, 0);
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return WATER_TEXTURE;
}

/** Круглая тень: прозрачная в середине, к краю — глубокая вода. */
function ensureWaterShade(scene: Phaser.Scene): string {
  if (scene.textures.exists(WATER_SHADE)) return WATER_SHADE;
  const size = 256;
  const texture = scene.textures.createCanvas(WATER_SHADE, size, size);
  if (texture === null) return WATER_SHADE;
  const gradient = texture.context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(10, 3, 32, 0)');
  gradient.addColorStop(WATER_SHADE_CLEAR, 'rgba(10, 3, 32, 0)');
  gradient.addColorStop(1, 'rgba(8, 2, 24, 0.62)');
  texture.context.fillStyle = gradient;
  texture.context.fillRect(0, 0, size, size);
  texture.refresh();
  return WATER_SHADE;
}

/** Кадры листа предметов воды — в текстуру, по water-decor.json. */
function installDecorFrames(scene: Phaser.Scene): DecorFrame[] {
  if (!scene.textures.exists(WATER_DECOR_ART)) return [];
  const texture = scene.textures.get(WATER_DECOR_ART);
  const frames: DecorFrame[] = [];
  for (const [name, [x = 0, y = 0, width = 0, height = 0]] of Object.entries(WATER_DECOR_FRAMES)) {
    if (!texture.has(name)) texture.add(name, 0, x, y, width, height);
    frames.push({ name, width, height });
  }
  return frames;
}

/** Цвет врага сейчас: свой — или в сиреневом тумане завесы. */
function tintOf(actor: Actor): number {
  return actor.slowed ? multiplyTint(actor.tint, FOG_TINT) : actor.tint;
}
