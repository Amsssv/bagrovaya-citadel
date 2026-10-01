import { useEffect, useRef, type ReactNode } from 'react';

import type { Board, MoveStage } from '@/entities/board';
import type { NightEvent } from '@/entities/wave';
import type { Audio } from '@/shared/audio';
import type { Direction, Position } from '@/shared/lib/geometry';
import { createGame } from '@/shared/phaser';

import { BoardScene } from './BoardScene';
import type { AttackZoneView, BossHp, TurretView } from './BoardScene';
import styles from './BoardView.module.scss';
import type { SceneLayout } from './layout';
import type { Quality } from './quality';
import type { Speed } from './timeline';

/**
 * Мост React ↔ Phaser.
 *
 * Канвас лежит нижним слоем и рисует только поле. Всё, что игрок читает и
 * нажимает, — React в слое `overlay` поверх; он сквозной для нажатий, чтобы
 * перетаскивание доходило до канваса.
 */
export type { AttackZoneView, TurretView } from './BoardScene';

const NO_TURRETS: readonly TurretView[] = [];

export interface BoardViewState {
  readonly board: Board;
  /** Шаги, которые привели к этому полю. Пусто — показать сразу. */
  readonly stages: readonly MoveStage[];
  /** Поле нового забега: плитки падают сверху, а не появляются разом. */
  readonly deal?: boolean;
}

/** Показ боя: меняется `token` — сцена начинает проигрывать лог заново. */
export interface BattleView {
  readonly events: readonly NightEvent[];
  readonly token: number;
}

interface BoardViewProps {
  readonly view: BoardViewState;
  readonly battle?: BattleView;
  readonly audio?: Audio;
  readonly onBattleEnd?: () => void;
  readonly speed?: Speed;
  /** Низкий режим гасит частицы: на исход боя они не влияют, а кадры едят. */
  readonly quality?: Quality;
  /**
   * Любое изменение убирает с поля всё боевое. Нужно при новом забеге: бой, на
   * котором пала цитадель, обрывается, и дожившие охотники иначе так и
   * остались бы стоять на новом поле.
   */
  readonly clearToken?: number;
  /** Любое изменение числа пропускает текущую анимацию. */
  readonly skipToken?: number;
  /** День над полем — во время Рассвета; всё остальное время ночь. */
  readonly daylight?: boolean;
  /**
   * Сколько снизу занимает интерфейс поверх канваса: поле встаёт выше, под
   * интерфейсом только облака.
   */
  readonly reserveBottom?: number;
  /** Жест по полю разобран сценой и приходит сюда готовой командой. */
  readonly onSwap?: (from: Position, to: Position) => void;
  /** Тап по клетке без свайпа. */
  readonly onTap?: (at: Position) => void;
  /** Палец держат на клетке — показать, что в ней. */
  readonly onInspect?: (at: Position) => void;
  /**
   * Клетку тянут за край поля: вверх из верхнего ряда — в башню замка, в
   * стороны и вниз — сброс за край (§3). Что это значит, решает вызывающий.
   */
  readonly onEdge?: (from: Position, direction: Direction) => void;
  /** Игра на паузе: реклама, окно площадки, скрытая вкладка. */
  readonly paused?: boolean;
  /** Столбец, откуда выйдет босс этой ночи: подсвечен в Сумерках. */
  readonly bossLane?: number | null;
  /** Какие клетки держит постройка — при осмотре и в обучении. */
  readonly attackZone?: AttackZoneView | null;
  /** Что стоит в башнях замка: рисуется над полем, в клетке за его краем. */
  readonly turrets?: readonly TurretView[];
  /** Анимация хода доиграна или пропущена. */
  readonly onStagesDone?: () => void;
  /** Капли крови за длинный матч долетели до шкалы. */
  readonly onBlood?: (amount: number) => void;
  /** Сцена загрузила арт и нарисовала первое поле. */
  readonly onReady?: () => void;
  /** Где на экране лежит сетка — для подсказок поверх поля. */
  readonly onLayout?: (layout: SceneLayout) => void;
  /** Жизни босса на поле; null — босса нет. */
  readonly onBoss?: (hp: BossHp | null) => void;
  /** Враг ударил по цитадели: сколько сердец осталось. */
  readonly onHearts?: (hearts: number) => void;
  /** Интерфейс поверх поля: шапка, кнопки, подсказки. */
  readonly children?: ReactNode;
}

export function BoardView({
  view,
  battle,
  audio,
  onBattleEnd,
  speed = 1,
  quality = 'high',
  skipToken = 0,
  clearToken = 0,
  daylight = false,
  reserveBottom = 0,
  onSwap,
  onTap,
  onInspect,
  onEdge,
  turrets,
  bossLane = null,
  attackZone = null,
  paused = false,
  onStagesDone,
  onBlood,
  onReady,
  onLayout,
  onBoss,
  onHearts,
  children,
}: BoardViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  // Сцена живёт дольше любого рендера, поэтому обработчики берём через ref —
  // иначе пришлось бы пересоздавать игру на каждое обновление React.
  const handlers = {
    onSwap,
    onTap,
    onInspect,
    onEdge,
    onReady,
    onHearts,
    onBoss,
    onLayout,
    onBlood,
    onStagesDone,
    onBattleEnd,
  };
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;

    const scene = new BoardScene();
    scene.onSwap((from, to) => handlersRef.current.onSwap?.(from, to));
    scene.onTap((at) => handlersRef.current.onTap?.(at));
    scene.onInspect((at) => handlersRef.current.onInspect?.(at));
    scene.onEdge((from, direction) => handlersRef.current.onEdge?.(from, direction));
    scene.onStagesDone(() => handlersRef.current.onStagesDone?.());
    scene.onBlood((amount) => handlersRef.current.onBlood?.(amount));
    scene.onReady(() => handlersRef.current.onReady?.());
    scene.onLayout((layout) => handlersRef.current.onLayout?.(layout));
    scene.onBoss((hp) => handlersRef.current.onBoss?.(hp));
    scene.onHearts((hearts) => handlersRef.current.onHearts?.(hearts));
    scene.onBattleEnd(() => handlersRef.current.onBattleEnd?.());
    const handle = createGame(host, [scene]);
    sceneRef.current = scene;

    return () => {
      sceneRef.current = null;
      handle.destroy();
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setAudio(audio ?? null);
  }, [audio]);

  useEffect(() => {
    sceneRef.current?.setTurrets(turrets ?? NO_TURRETS);
  }, [turrets]);

  useEffect(() => {
    sceneRef.current?.setBossLane(bossLane);
  }, [bossLane]);

  useEffect(() => {
    sceneRef.current?.setAttackZone(attackZone);
  }, [attackZone]);

  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    sceneRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    sceneRef.current?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    if (clearToken > 0) sceneRef.current?.stopBattle();
  }, [clearToken]);

  useEffect(() => {
    sceneRef.current?.setDaylight(daylight);
  }, [daylight]);

  useEffect(() => {
    sceneRef.current?.setReserveBottom(reserveBottom);
  }, [reserveBottom]);

  useEffect(() => {
    if (skipToken > 0) {
      sceneRef.current?.skip();
      sceneRef.current?.skipBattle();
    }
  }, [skipToken]);

  useEffect(() => {
    if (battle !== undefined && battle.token > 0) sceneRef.current?.playBattle(battle.events);
  }, [battle]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (scene === null) return;
    if (view.stages.length > 0) scene.playStages(view.stages);
    else if (view.deal === true) scene.dealIn(view.board);
    else scene.showBoard(view.board);
  }, [view]);

  return (
    <div className={styles.stage}>
      <div className={styles.canvas} ref={hostRef} />
      <div className={styles.overlay}>{children}</div>
    </div>
  );
}
