import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  bestOf,
  betterRecord,
  chooseSave,
  isExhausted,
  loadSave,
  recordOf,
  serializeSave,
  withBest,
} from '@/entities/player';
import { specFor, statsAt } from '@/entities/enemy';
import { attackZone, nextBossNight } from '@/entities/wave';
import type { NightHistory, PlayerMove, RunState } from '@/processes/night';
import {
  canPlay,
  canRepair,
  canUndo,
  giveUp,
  isRunOver,
  openNight,
  remember,
  repairCitadel,
  canPlayDayOff,
  finishDayOff,
  canTakeDayOff,
  startDayOff,
  stepDayOff,
  runDawn,
  runToSave,
  stepInTwilight,
  undo,
} from '@/processes/night';
import type { LeaderboardEntry, PlatformAdapter, PlayerMode } from '@/shared/api';
import { createSaveGate } from '@/shared/api';
import { createAudio, createWebAudioBackend, musicForNight } from '@/shared/audio';
import { AUDIO_CONFIG } from '@/shared/config/audio';
import { CITADEL_CONFIG } from '@/shared/config/citadel';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import { ENEMY_BOOK } from '@/shared/config/enemies';
import { SCORE_CONFIG } from '@/shared/config/score';
import { BOSS_CONFIG } from '@/shared/config/bosses';
import { PLATFORM_CONFIG } from '@/shared/config/platform';
import type { Lang } from '@/shared/lib/i18n';
import { restoreRng } from '@/shared/lib/rng';
import { getLang, t } from '@/shared/lib/i18n';
import { ConfirmSheet, Icon, hideLoading } from '@/shared/ui';
import type { Direction, Position } from '@/shared/lib/geometry';
import { step } from '@/shared/lib/geometry';
import type { SoundSettings } from '@/features/adjust-sound';
import { SoundControl, effectiveVolume } from '@/features/adjust-sound';
import { LanguageSelect } from '@/features/switch-lang';
import type { Beat, TipId } from '@/features/tutorial';
import { TUTORIAL_BEATS, focusCells, isCard, isExpectedMove, nextTip } from '@/features/tutorial';
import { watchRewarded } from '@/features/watch-rewarded-ad';
import type {
  AttackZoneView,
  BattleView,
  BoardViewState,
  BossHp,
  Quality,
  SceneLayout,
  Speed,
  TurretView,
} from '@/widgets/board';
import { BoardView, DAYLIGHT_MS, cellToScreen } from '@/widgets/board';
import { BloodMeter } from '@/widgets/blood-meter';
import { BossBar } from '@/widgets/boss-bar';
import type { CellInfo } from '@/widgets/guide';
import { GuidePanel, describeCell } from '@/widgets/guide';
import { RecordsPanel, recordsView } from '@/widgets/records';
import { RunOverPanel } from '@/widgets/run-over';
import type { CoachGesture, CoachRect } from '@/widgets/tutorial';
import { Coach, TipCard, beatText as textOfBeat, tipFrame, tipText } from '@/widgets/tutorial';

import styles from './App.module.scss';
import { Water } from './Water';
import type { BonusToast } from './bonusToast';
import { bonusToast } from './bonusToast';
import { applyLang, saveLangChoice } from './lang';
import { SAVE_INTERVAL_MS, STORAGE_KEY, boot } from './persistence';
import { PILOT, PILOT_STORAGE, useBotPilot } from './botPilot';
import { withTutorial } from './tutorialRun';

/**
 * Экран ночи: Сумерки, Рассвет, следующая ночь.
 *
 * Все цифры — из `shared/config/balance.ts`. Большая часть там выдумана
 * (§14 #5, #7, #8, #9, #10) и помечена ⚠️: пока их не сняли с оригинала, по
 * тому, сколько ночей держится оборона, об оригинале судить нельзя.
 *
 * Состояние живёт здесь: `app` — единственный слой, которому по правилам FSD
 * можно тянуть процессы.
 *
 * Площадка подключена так, чтобы её отказ не был заметен: при полном отказе SDK
 * игра идёт на местном сохранении, кнопка ролика не появляется, а летопись
 * показывает рекорд с устройства.
 */
/** Сколько висит надпись о бонусной крови. */
const BONUS_TOAST_MS = 1600;
/** Сколько висит объяснение, почему нельзя отменить ход. */
const NOTICE_MS = 2200;
/**
 * Полноэкранная реклама — раз в 10 минут игры, то есть не больше шести раз в
 * час. Время идёт, только пока игра на экране и не на паузе.
 */
const FULLSCREEN_EVERY_S = 600;
/** Облако пишется реже устройства: площадка не любит частые записи. */
const CLOUD_SAVE_INTERVAL_MS = 30_000;

export interface AppProps {
  /** Площадка поднимается до первого кадра: от неё зависит язык (п. 2.14). */
  readonly platform: PlatformAdapter;
}

interface CoachView {
  readonly hole: CoachRect | null;
  readonly gesture: CoachGesture;
  readonly from?: { x: number; y: number };
  readonly to?: { x: number; y: number };
}

/**
 * Где подсветка обучения и какой жест показывает рука. Ход — окно над его
 * клетками; отмена — окно над кнопкой; бой — одна подсказка, без окна.
 */
function coachFor(
  beat: Beat | undefined,
  layout: SceneLayout | null,
  undoButton: HTMLButtonElement | null,
): CoachView | null {
  if (beat === undefined) return null;
  if (beat.kind === 'battle') return { hole: null, gesture: 'tap' };
  if (beat.kind === 'undo') {
    if (undoButton === null) return null;
    const rect = undoButton.getBoundingClientRect();
    const pad = 6;
    return {
      hole: {
        x: rect.x - pad,
        y: rect.y - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      },
      gesture: 'tap',
      from: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    };
  }
  if (beat.kind !== 'move' || layout === null) return null;
  const centres = focusCells(beat).map((cell) => cellToScreen(layout, cell));
  const [first] = centres;
  if (first === undefined) return null;
  const half = layout.cellSize / 2 + 4;
  const xs = centres.map((point) => point.x);
  const ys = centres.map((point) => point.y);
  const x = Math.min(...xs) - half;
  const y = Math.min(...ys) - half;
  const hole = { x, y, width: Math.max(...xs) + half - x, height: Math.max(...ys) + half - y };
  const { move } = beat;
  if (move.type === 'swap') {
    return {
      hole,
      gesture: 'drag',
      from: cellToScreen(layout, move.from),
      to: cellToScreen(layout, move.to),
    };
  }
  if (move.type === 'drop' || move.type === 'nest') {
    // Рука тянет за край — на клетку дальше поля: прочь или в башню.
    const OFF: Readonly<Record<Direction, readonly [number, number]>> = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const [dx, dy] = OFF[move.direction];
    return {
      hole,
      gesture: 'drag',
      from: first,
      to: { x: first.x + dx * layout.cellSize, y: first.y + dy * layout.cellSize },
    };
  }
  return { hole, gesture: 'tap', from: first };
}

export function App({ platform }: AppProps) {
  const [session, setSession] = useState(() => {
    const first = boot(PILOT_STORAGE === undefined ? {} : { storage: PILOT_STORAGE, fresh: true });
    return withTutorial(first, !first.save.settings.tutorialDone && PILOT === null);
  });
  const { options, storage, refillRng, level } = session;

  const [run, setRun] = useState<RunState>(session.run);
  // Сохранённый забег продолжается с того же поля; новый — раздаётся сверху.
  const [view, setView] = useState<BoardViewState>(() => ({
    board: session.run.board,
    stages: [],
    deal: session.fresh,
  }));
  const [battle, setBattle] = useState<BattleView>({ events: [], token: 0 });
  /** Итог ночи ждёт, пока бой доиграет: цифры в шапке не должны обгонять показ. */
  const [afterDawn, setAfterDawn] = useState<RunState | null>(null);
  /** Тот же итог, но для чтения из обработчиков: конец боя открывает новую ночь. */
  const afterDawnRef = useRef<RunState | null>(null);
  const [speed, setSpeed] = useState<Speed>(session.save.settings.speed);
  // Частицы — всегда: переключателя больше нет, в нём никто не разбирался.
  // Низкий режим остаётся в сцене на случай, если его будут включать сами.
  const quality: Quality = 'high';
  const [skipToken, setSkipToken] = useState(0);
  /** Новый забег: сцена убирает с поля охотников, оставшихся от прошлого. */
  const [clearToken, setClearToken] = useState(0);
  /** Кровь за длинный матч, которая ещё летит к шкале: шкала её пока не показывает. */
  const [bloodInFlight, setBloodInFlight] = useState(0);
  /** Итог забега закрыли, чтобы посмотреть на поле. */
  const [overDismissed, setOverDismissed] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Пауза — как в matching-game, из трёх независимых источников: вкладка
  // скрыта, идёт наша реклама, площадка сама открыла своё окно
  // (game_api_pause). Под паузой звук молчит, поле стоит (требования 4.7 и
  // 1.19.4), а площадке уходит «геймплей стоп».
  const [adPaused, setAdPaused] = useState(false);
  const [platformPaused, setPlatformPaused] = useState(false);
  const paused = hidden || adPaused || platformPaused;
  /** Надпись о бонусной крови: комбо и длинные слияния. `key` перезапускает её. */
  const [bonus, setBonus] = useState<(BonusToast & { key: number }) | null>(null);
  useEffect(() => {
    if (bonus === null) return;
    const timer = window.setTimeout(() => setBonus(null), BONUS_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [bonus]);
  // Строки берутся из модуля i18n синхронно; состояние здесь — только чтобы
  // смена языка перерисовала всё дерево.
  const [lang, setLangState] = useState<Lang>(getLang);
  const changeLang = useCallback((next: Lang) => {
    applyLang(next);
    saveLangChoice(next);
    setLangState(next);
  }, []);

  const [platformReady, setPlatformReady] = useState(false);
  const [platformInited, setPlatformInited] = useState(false);
  /** Сцена поля загрузила арт и нарисовала первое поле. */
  const [sceneReady, setSceneReady] = useState(false);
  const readySent = useRef(false);

  // Канвас лежит под всем экраном, подвал — поверх облаков. Поле под подвал
  // заходить не должно, поэтому сцене сообщаем, сколько он занимает снизу,
  // вместе с безопасной зоной телефона.
  const footerRef = useRef<HTMLElement>(null);
  const [reserveBottom, setReserveBottom] = useState(0);
  useEffect(() => {
    const footer = footerRef.current;
    const screen = footer?.parentElement;
    if (footer === null || screen === null || screen === undefined) return;
    const measure = (): void => {
      // Подвал без раскладки (скрыт, ещё не встал) даёт top = 0 и «занимает»
      // весь экран — поле схлопнулось бы. Такой замер пропускаем.
      if (footer.offsetHeight === 0) return;
      setReserveBottom(screen.getBoundingClientRect().bottom - footer.getBoundingClientRect().top);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const [mode, setMode] = useState<PlayerMode>('guest');
  const [rows, setRows] = useState<readonly LeaderboardEntry[]>([]);
  const [recordsOpen, setRecordsOpen] = useState(false);
  // ── обучение ────────────────────────────────────────────────────────────
  // Идёт в новом забеге, пока его не прошли; забег, поднятый из сейва на
  // середине, доигрывается без него.
  /** Подсказки к первой встрече, которые уже показаны. */
  const [tips, setTips] = useState<readonly string[]>(session.save.settings.tips);
  // Бот за игрока — только на dev-сервере, `?bot=1` (app/botPilot.ts).
  const pilot = PILOT;
  // Номер шага сценария (features/tutorial/script.ts); null — обучения нет.
  const [beatIndex, setBeatIndex] = useState<number | null>(() =>
    !session.save.settings.tutorialDone && session.fresh && pilot === null ? 0 : null,
  );
  const beatRef = useRef(beatIndex);
  const [tutorialDone, setTutorialDone] = useState(session.save.settings.tutorialDone);
  const setBeat = useCallback((next: number | null) => {
    // Прошли последний шаг — обучение пройдено насовсем; подсказки к тому,
    // что оно уже показало, больше не нужны.
    const finished = next !== null && next >= TUTORIAL_BEATS.length;
    if (finished) {
      setTutorialDone(true);
      setTips((seen) => [
        ...new Set([...seen, 'gargoyle', 'vine', 'mortar', 'fogveil', 'potion', 'turret']),
      ]);
    }
    const value = finished ? null : next;
    beatRef.current = value;
    setBeatIndex(value);
  }, []);
  const beat: Beat | undefined = beatIndex === null ? undefined : TUTORIAL_BEATS[beatIndex];
  const nextBeat = useCallback(() => {
    if (beatRef.current !== null) setBeat(beatRef.current + 1);
  }, [setBeat]);
  /** Поле доиграло анимацию хода: подсказка не должна обгонять постройку. */
  const [settled, setSettled] = useState(true);
  const [layout, setLayout] = useState<SceneLayout | null>(null);
  /** В какую ночь уже напомнили о Проповеднике: напоминание — раз за его ночь. */
  const [bossNoticeNight, setBossNoticeNight] = useState<number | null>(null);
  /** Проповедник пал: ночь победы и следующая ночь босса (null — последний). */
  const [victory, setVictory] = useState<{ night: number; next: number | null } | null>(null);
  /** Долгое нажатие на клетку — карточка о том, что в ней. */
  const [inspect, setInspect] = useState<CellInfo | null>(null);
  // Где осматриваемая клетка — ей подсвечивается зона атаки.
  const [inspectAt, setInspectAt] = useState<Position | null>(null);
  /**
   * Сердца во время боя — вживую, по ударам по воротам; `hit` перезапускает
   * вздрагивание сердца в шапке. null — боя нет, в шапке сердца забега.
   */
  const [liveHearts, setLiveHearts] = useState<{ hearts: number; hit: number } | null>(null);
  const handleHearts = useCallback((hearts: number) => {
    setLiveHearts({ hearts, hit: Date.now() });
  }, []);
  /** Жизни Проповедника на поле — полоска внизу вместо шкалы крови. */
  const [bossHp, setBossHp] = useState<BossHp | null>(null);
  /** Кнопка отмены — шаг обучения «отмени» подсвечивает её. */
  const [undoButton, setUndoButton] = useState<HTMLButtonElement | null>(null);

  // Справка у новичка больше не открывается сама — вместо неё обучение.
  // Дальше она живёт за кнопкой «?».
  const [guideSeen, setGuideSeen] = useState(session.save.settings.guideSeen);
  const [guideOpen, setGuideOpen] = useState(false);
  const [confirmToss, setConfirmToss] = useState(session.save.settings.confirmToss);
  /** Подтверждения: выбросить постройку за край, сдаться. */
  const [tossAsk, setTossAsk] = useState<{
    readonly from: Position;
    readonly direction: Direction;
    readonly frame: string;
  } | null>(null);
  const [giveUpAsk, setGiveUpAsk] = useState(false);

  const closeGuide = useCallback(() => {
    setGuideOpen(false);
    setGuideSeen(true);
  }, []);
  const closeRecords = useCallback(() => {
    setRecordsOpen(false);
  }, []);

  const [sound, setSound] = useState<SoundSettings>(session.save.settings.sound);
  const [audio] = useState(() =>
    createAudio(createWebAudioBackend(), {
      music: effectiveVolume(session.save.settings.sound, 'music'),
      sfx: effectiveVolume(session.save.settings.sound, 'sfx'),
    }),
  );
  useEffect(() => {
    audio.setVolume('music', effectiveVolume(sound, 'music'));
    audio.setVolume('sfx', effectiveVolume(sound, 'sfx'));
  }, [audio, sound]);

  const atDawn = afterDawn !== null;
  const over = isRunOver(run);

  // ── звук ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Браузер не даёт поднять Web Audio без жеста: до первого касания игра
    // молчит и ни на что не жалуется.
    const unlock = (): void => {
      audio.unlock();
    };
    document.addEventListener('pointerdown', unlock, { once: true });

    const onVisibility = (): void => {
      setHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [audio]);

  useEffect(() => {
    audio.setPaused(paused);
  }, [audio, paused]);

  useEffect(() => platform.onPause(setPlatformPaused), [platform]);

  useEffect(() => {
    audio.music(
      musicForNight(run.night, {
        bossNights: BOSS_CONFIG.nights,
        tenseFromNight: AUDIO_CONFIG.tenseFromNight,
      }),
    );
  }, [audio, run.night]);

  // ── площадка ────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    void platform.init().then(() => {
      if (!alive) return;
      setPlatformInited(true);
      setPlatformReady(platform.isReady());
      setMode(platform.getPlayerMode());
    });

    return () => {
      alive = false;
      platform.gameplayStop();
    };
  }, [platform]);

  useEffect(() => {
    // Пары start/stop обязаны сходиться, поэтому состояние выводится из одного
    // условия, а не рассылается из каждой точки кода.
    if (!over && !recordsOpen && !guideOpen && !paused && !giveUpAsk && tossAsk === null) {
      platform.gameplayStart();
      return;
    }
    platform.gameplayStop();
  }, [giveUpAsk, guideOpen, over, paused, platform, recordsOpen, tossAsk]);

  /**
   * Показать рекламу на паузе: игра замолкает ДО запроса и оживает только когда
   * реклама кончилась по любой причине — не по награде, она приходит, пока
   * ролик ещё идёт (как `runAdWithGamePaused` в matching-game).
   */
  const runAd = useCallback(
    async <T,>(show: () => Promise<T>): Promise<T> => {
      audio.setPaused(true);
      setAdPaused(true);
      try {
        return await show();
      } finally {
        setAdPaused(false);
      }
    },
    [audio],
  );

  // Реклама в игре — только в двух случаях: полноэкранная раз в 10 минут игры
  // и ролик за ремонт цитадели раз за сессию. Полноэкранная ждёт естественной
  // паузы — конца ночи или нового забега, — а не выскакивает посреди хода.
  const playSecondsRef = useRef(0);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!pausedRef.current) playSecondsRef.current += 1;
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  /** Пора показать полноэкранную — показываем; нет — сразу дальше. */
  const fullscreenIfDue = useCallback(async (): Promise<void> => {
    if (!platformReady || playSecondsRef.current < FULLSCREEN_EVERY_S) return;
    playSecondsRef.current = 0;
    await runAd(() => platform.showFullscreen());
  }, [platform, platformReady, runAd]);

  // Площадке говорят о готовности один раз и только когда играть уже можно:
  // SDK поднят, а поле загружено и нарисовано. До этого она считает, что игра
  // ещё грузится, — и так оно и есть.
  useEffect(() => {
    if (!platformInited || !sceneReady || readySent.current) return;
    readySent.current = true;
    platform.gameReady();
  }, [platform, platformInited, sceneReady]);

  // Экран загрузки ждёт только поле: без площадки игра всё равно играется.
  const handleSceneReady = useCallback(() => {
    hideLoading();
    setSceneReady(true);
  }, []);

  // ── летопись ────────────────────────────────────────────────────────────
  // Рекорд не копится в состоянии: это просто лучшее из сохранённого и текущего
  // забега, а счётчики забега только растут.
  const best = useMemo(
    () =>
      betterRecord(bestOf(session.save.best, level.id), recordOf(run.stats, SCORE_CONFIG.weights)),
    [level.id, run.stats, session.save.best],
  );

  // Рекорд — в летопись площадки, как в matching-game: при подъёме площадки
  // (догнать прогресс, сыгранный без сети или до входа) и после каждой ночи.
  // Пишется, только если строго лучше, через очередь раз в секунду — это
  // делает адаптер (`submitScore`), здесь только когда.
  const submitted = useRef(-1);
  useEffect(() => {
    if (!platformReady || best.score <= submitted.current) return;
    submitted.current = best.score;
    void platform.submitScore(level.leaderboard, best.score);
  }, [best.score, level.leaderboard, platform, platformReady]);

  const loadRows = useCallback(() => {
    void platform.getLeaderboard(level.leaderboard, PLATFORM_CONFIG.topCount).then(setRows);
  }, [level.leaderboard, platform]);

  const openRecords = useCallback(() => {
    setRecordsOpen(true);
    loadRows();
  }, [loadRows]);

  const [signIns, setSignIns] = useState(0);
  const handleSignIn = useCallback(() => {
    void platform.requestAuth().then((signedIn) => {
      if (!signedIn) return;
      setMode(platform.getPlayerMode());
      loadRows();
      // Вошёл — сверяем сейв с облаком заново.
      setSignIns((count) => count + 1);
    });
  }, [loadRows, platform]);

  const records = useMemo(
    () => recordsView({ best, ready: platformReady, mode, rows, limit: PLATFORM_CONFIG.topCount }),
    [best, mode, platformReady, rows],
  );

  // ── сохранение ──────────────────────────────────────────────────────────
  const [gate] = useState(() =>
    createSaveGate((value) => {
      storage.write(STORAGE_KEY, value);
    }, SAVE_INTERVAL_MS),
  );
  const snapshotRef = useRef('');
  // Облако — как в matching-game: для вошедшего игрока, реже местного и
  // только после сверки (`syncCloud`): иначе местный сейв затёр бы облачный
  // раньше, чем мы его прочитали.
  const [cloudGate] = useState(() =>
    createSaveGate((value) => {
      void platform.saveData(value);
    }, CLOUD_SAVE_INTERVAL_MS),
  );
  const cloudSyncedRef = useRef(false);
  /** Что было в сейве в прошлый раз — без отметки времени. */
  const contentRef = useRef<string | null>(null);
  const savedAtRef = useRef(session.save.savedAt);
  /** Игрок на этом устройстве что-то сделал после запуска. */
  const touchedRef = useRef(false);
  const nightRef = useRef(run.night);

  useEffect(() => {
    const data = {
      ...runToSave(run, refillRng, level.id, session.save),
      best: withBest(session.save.best, level.id, best),
      settings: {
        ...session.save.settings,
        speed,
        guideSeen,
        sound,
        tutorialDone,
        tips: [...tips],
        confirmToss,
      },
    };
    // Отметка времени — только когда сейв правда поменялся: иначе он
    // «менялся» бы каждую секунду и ехал в облако впустую.
    const content = serializeSave({ ...data, savedAt: 0 });
    if (contentRef.current !== null && content !== contentRef.current) {
      savedAtRef.current = Date.now();
      touchedRef.current = true;
    }
    contentRef.current = content;
    snapshotRef.current = serializeSave({ ...data, savedAt: savedAtRef.current });
    gate.request(snapshotRef.current, Date.now());
    if (!cloudSyncedRef.current) return;
    cloudGate.request(snapshotRef.current, Date.now());
    // Конец ночи и конец забега — в облако сразу, не дожидаясь интервала.
    if (run.night !== nightRef.current || isRunOver(run)) cloudGate.flush(Date.now());
    nightRef.current = run.night;
  }, [
    best,
    cloudGate,
    gate,
    guideSeen,
    level.id,
    refillRng,
    run,
    session.save,
    sound,
    speed,
    tips,
    tutorialDone,
    confirmToss,
  ]);

  useEffect(() => {
    // Отложенное сохранение надо чем-то догонять: иначе последний ход лёг бы
    // в хранилище только при следующем.
    const timer = window.setInterval(() => {
      gate.request(snapshotRef.current, Date.now());
      if (cloudSyncedRef.current) cloudGate.request(snapshotRef.current, Date.now());
    }, 1000);

    // Уход в фон и закрытие вкладки — последний шанс записать.
    const flush = (): void => {
      gate.flush(Date.now());
      if (cloudSyncedRef.current) cloudGate.flush(Date.now());
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);

    return () => {
      flush();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [cloudGate, gate]);

  // ── ходы ────────────────────────────────────────────────────────────────
  // Ход считается от ref, а не внутри обновителя setRun: обновитель в
  // StrictMode зовут дважды, а ход тратит поток досыпки и копит кровь в пути —
  // посчитанный дважды, он развёл бы поле, анимацию и шкалу.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // Память ночи для отмены хода. Читается синхронно из ref — по той же причине,
  // что и забег: отмена меняет поток досыпки, дважды её делать нельзя; копия в
  // состоянии — только чтобы кнопка перерисовывалась.
  const [history, setHistoryState] = useState<NightHistory<RunState>>(() =>
    openNight(session.run, session.refillRng),
  );
  const historyRef = useRef(history);
  const setHistory = useCallback((next: NightHistory<RunState>) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  const play = useCallback(
    (move: PlayerMove) => {
      const current = runRef.current;
      // Кровь кончилась — ночь кончилась, даже если поле ещё доигрывает ход:
      // выпить потир в эту щель нельзя.
      if (atDawn || isExhausted(current.purse)) return;
      const twilight = {
        board: current.board,
        purse: current.purse,
        inventory: current.inventory,
        nests: current.nests,
      };
      // В обучении проходит только ход, которого ждёт шаг сценария.
      const current_beat = beatRef.current === null ? undefined : TUTORIAL_BEATS[beatRef.current];
      if (beatRef.current !== null && !isExpectedMove(current_beat, move)) return;
      // Выходной: ходы бесплатные и без досыпки, пить и сбрасывать нельзя.
      const dayOff = current.dayOff === true;
      const legal = dayOff
        ? canPlayDayOff(current, move, options)
        : canPlay(twilight, move, options);
      if (!legal) {
        // Глухой стук — только на свап: случайный тап по полю молчит.
        if (move.type === 'swap') audio.play('blocked');
        return;
      }

      // Снимок потока — до хода: ход его сдвинет, если будет досыпка.
      const rng = options.rng.snapshot();
      const { run: next, step } = dayOff
        ? stepDayOff(current, move, options)
        : stepInTwilight(current, move, options);
      setHistory(remember(historyRef.current, current, rng, step.move.refilled));
      runRef.current = next;
      setRun(next);
      setView({ board: next.board, stages: step.move.stages });
      if (step.move.stages.length > 0) setSettled(false);
      if (beatRef.current !== null) setBeat(beatRef.current + 1);
      if (step.bonus > 0) setBloodInFlight((pending) => pending + step.bonus);
      const toast = bonusToast(step.groups, step.comboBonus, step.mergeBonus);
      if (toast !== null) setBonus({ ...toast, key: Date.now() });
    },
    [atDawn, audio, options, setBeat, setHistory],
  );

  // Отмена — как в оригинале: откатить можно сколько угодно ходов подряд, пока
  // после них не падали новые плитки. Последний ход ночи не отменить — рассвет
  // наступает сам.
  // В обучении отмена — только на своём шаге: иначе сценарий разъехался бы.
  const undoable =
    !atDawn &&
    !over &&
    !isExhausted(run.purse) &&
    canUndo(history) &&
    (beat === undefined || beat.kind === 'undo');
  const undoMove = useCallback(() => {
    if (atDawn || isExhausted(runRef.current.purse) || !canUndo(historyRef.current)) return;
    const tutorialBeat = beatRef.current === null ? undefined : TUTORIAL_BEATS[beatRef.current];
    if (tutorialBeat !== undefined && tutorialBeat.kind !== 'undo') return;
    if (tutorialBeat !== undefined) nextBeat();
    const back = undo(historyRef.current);
    const rng = restoreRng(back.rng);
    setHistory(back.history);
    setSession((current) => ({
      ...current,
      refillRng: rng,
      options: { ...current.options, rng },
    }));
    runRef.current = back.state;
    setRun(back.state);
    setView({ board: back.state.board, stages: [] });
    setBloodInFlight(0);
  }, [atDawn, nextBeat, setHistory]);

  // Отменить нельзя — объясняем, как оригинал: в бою «поздно», иначе — что
  // отмена живёт, пока не упали новые плитки.
  const [notice, setNotice] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const explainUndo = useCallback(() => {
    // В обучении кнопка ждёт своего шага — объяснять нечего.
    if (beatRef.current !== null) return;
    setNotice({
      text: atDawn ? t('app.tooLateTheOrder') : t('app.youCanUndoOnly'),
      key: Date.now(),
    });
  }, [atDawn]);

  const handleBlood = useCallback((amount: number) => {
    setBloodInFlight((pending) => Math.max(0, pending - amount));
  }, []);

  const handleSwap = useCallback(
    (from: Position, to: Position) => {
      play({ type: 'swap', from, to });
    },
    [play],
  );

  // За край поля тянут двумя способами: вверх из верхнего ряда — горгулью в
  // башню замка, в стороны и вниз — сырую плитку прочь с поля (§3). Какой ход
  // из этого законен, решает домен.
  // Выбросить за край готовую постройку — как «Toss Away» в оригинале:
  // сначала спрашиваем. Спрашивать или нет — переключатель в настройках.
  const handleEdge = useCallback(
    (from: Position, direction: Direction) => {
      if (direction === 'up') {
        play({ type: 'nest', from, direction });
        return;
      }
      // В выходной за край не сбрасывают: на место ничего не упадёт.
      if (runRef.current.dayOff === true) return;
      const board = runRef.current.board;
      const cell = board.cells[from.y * board.width + from.x];
      if (cell?.kind === 'building' && beatRef.current === null && confirmToss) {
        setTossAsk({ from, direction, frame: `${cell.building}-${cell.tier}` });
        return;
      }
      play({ type: 'drop', from, direction });
    },
    [confirmToss, play],
  );
  const toss = useCallback(() => {
    if (tossAsk === null) return;
    setTossAsk(null);
    play({ type: 'drop', from: tossAsk.from, direction: tossAsk.direction });
  }, [play, tossAsk]);

  // Выходной — «Rearrange Day» оригинала (processes/night/dayOff.ts): в
  // начале ночи после ночи босса игрока спрашивают, взять ли его. Спросили в
  // эту ночь — больше не спрашиваем, даже если отказался.
  const [dayOffAsked, setDayOffAsked] = useState<number | null>(null);
  const takeDayOff = useCallback(() => {
    setDayOffAsked(runRef.current.night);
    const next = startDayOff(runRef.current);
    runRef.current = next;
    setRun(next);
    setHistory(openNight(next, refillRng));
  }, [refillRng, setHistory]);
  const declineDayOff = useCallback(() => {
    setDayOffAsked(runRef.current.night);
  }, []);
  // «Готово»: новые плитки падают в пустые клетки, потом — рассвет, как после
  // любой ночи: кровь потрачена, и `handleStagesDone` его запустит, когда
  // сцена доиграет оседание.
  const finishRearrange = useCallback(() => {
    const { run: next, stages } = finishDayOff(runRef.current, options);
    runRef.current = next;
    setRun(next);
    setHistory(openNight(next, refillRng));
    setView({ board: next.board, stages });
    setSettled(false);
  }, [options, refillRng, setHistory]);

  // Сдаться — как «Give Up» в оригинале: забег кончается сразу, с
  // подтверждением. Итог и рекорд — как при падении цитадели.
  const surrender = useCallback(() => {
    setGiveUpAsk(false);
    const next = giveUp(runRef.current);
    runRef.current = next;
    setRun(next);
    setOverDismissed(false);
  }, []);

  const handleInspect = useCallback((at: Position) => {
    // В обучении у каждого касания своё дело — осмотр не мешает сценарию.
    if (beatRef.current !== null) return;
    const board = runRef.current.board;
    const cell = board.cells[at.y * board.width + at.x];
    setInspect(cell === undefined ? null : describeCell(cell));
    setInspectAt(at);
  }, []);

  const turrets = useMemo<readonly TurretView[]>(
    () =>
      run.nests.slots.flatMap((slot) => {
        const contents = run.nests.occupied[slot.id];
        return contents === undefined
          ? []
          : [{ at: step(slot.from, slot.direction), cell: contents.cell }];
      }),
    [run.nests],
  );

  // Зона атаки на поле: осматриваемой постройки или той, о которой карточка
  // обучения. Клетки — из той же геометрии, что и расчёт боя (`attackZone`).
  const zoneAt = beat?.kind === 'card' ? (beat.zone ?? null) : inspect === null ? null : inspectAt;
  const zoneView = useMemo<AttackZoneView | null>(() => {
    if (zoneAt === null) return null;
    const board = run.board;
    // Над полем — башня замка: бьёт со своим радиусом.
    const slot = run.nests.slots.find((candidate) => {
      const spot = step(candidate.from, candidate.direction);
      return spot.x === zoneAt.x && spot.y === zoneAt.y;
    });
    const tower = slot === undefined ? undefined : run.nests.occupied[slot.id]?.cell;
    const cell = zoneAt.y < 0 ? tower : board.cells[zoneAt.y * board.width + zoneAt.x];
    if (cell?.kind !== 'building') return null;
    const cells = attackZone(board, zoneAt, cell, options.buildings, {
      shootDepth: options.shootDepth,
      range: zoneAt.y < 0 ? options.turretRange : undefined,
    });
    return { building: cell.building, origin: zoneAt, cells };
  }, [options, run.board, run.nests, zoneAt]);

  // Тап: потир — выпить; по чему-то другому — ничего. Мортиру не разворачивают:
  // она сама поворачивается к врагу. Свайп потира — обычный свап, поэтому три
  // потира по-прежнему сливаются.
  const handleTap = useCallback(
    (at: Position) => {
      play({ type: 'open', at });
    },
    [play],
  );

  const handleDawn = useCallback(() => {
    if (atDawn || over) return;
    const report = runDawn(run, options);
    afterDawnRef.current = report.after;
    setAfterDawn(report.after);
    setBattle((current) => ({
      events: report.dawn.events,
      token: current.token + 1,
    }));
  }, [atDawn, options, over, run]);

  // Рассвет наступает сам: кровь кончилась, и поле доиграло последний ход.
  // Запуск — отсюда, а не из эффекта: сигнал «доиграно» и есть тот момент.
  const handleStagesDone = useCallback(() => {
    setSettled(true);
    if (!isExhausted(run.purse)) return;
    // В обучении рассвет ждёт карточку: игрок сначала читает, что будет.
    if (beatRef.current !== null) return;
    handleDawn();
  }, [handleDawn, run.purse]);

  const dismissTutorialCard = useCallback(() => {
    const current = beatRef.current === null ? undefined : TUTORIAL_BEATS[beatRef.current];
    nextBeat();
    if (current?.kind === 'dawn') handleDawn();
  }, [handleDawn, nextBeat]);

  const dismissTip = useCallback((id: TipId) => {
    setTips((seen) => (seen.includes(id) ? seen : [...seen, id]));
  }, []);

  const handleBattleEnd = useCallback(() => {
    // Первый день обучения кончился — итоговая карточка.
    if (beatRef.current !== null && TUTORIAL_BEATS[beatRef.current]?.kind === 'battle') nextBeat();
    const pending = afterDawnRef.current;
    afterDawnRef.current = null;
    setAfterDawn(null);
    setLiveHearts(null);
    if (pending === null) return;
    // Проповедник пал — поздравление, как «Good Work!» у матери драконов в
    // оригинале, и цель на следующего.
    if (pending.stats.bossesKilled > runRef.current.stats.bossesKilled && !isRunOver(pending)) {
      setVictory({ night: runRef.current.night, next: nextBossNight(BOSS_CONFIG, pending.night) });
    }
    runRef.current = pending;
    setRun(pending);
    // Новая ночь — новая отмена.
    setHistory(openNight(pending, refillRng));
    // Между ночами — естественная пауза для полноэкранной рекламы. В обучении
    // её нет: первый день не прерываем.
    if (beatRef.current === null) void fullscreenIfDue();
  }, [fullscreenIfDue, nextBeat, refillRng, setHistory]);

  // Новый забег — в той же цитадели: выбора цитадели пока нет.
  const restartNow = useCallback(() => {
    // Новый забег читает сейв с диска, а запись идёт с задержкой: без сброса
    // только что поставленный рекорд потерялся бы.
    gate.flush(Date.now());
    // Начали заново посреди обучения — и обучение с начала.
    const tutorial = beatRef.current !== null;
    const next = withTutorial(
      boot({ level: level.id, fresh: true, ...(PILOT_STORAGE && { storage: PILOT_STORAGE }) }),
      tutorial && PILOT === null,
    );
    if (tutorial) setBeat(0);
    setSession(next);
    runRef.current = next.run;
    setRun(next.run);
    setHistory(openNight(next.run, next.refillRng));
    setView({ board: next.run.board, stages: [], deal: true });
    afterDawnRef.current = null;
    setAfterDawn(null);
    setOverDismissed(false);
    setBloodInFlight(0);
    setClearToken((token) => token + 1);
  }, [gate, level.id, setBeat, setHistory]);

  /**
   * Поднять игру заново из сейва на устройстве — после того как туда лёг
   * облачный. Всё, что живёт в состоянии, берётся из сейва: забег, рекорды,
   * настройки; обучения нет — забег не новый.
   */
  const adoptSaved = useCallback(() => {
    const next = boot(PILOT_STORAGE === undefined ? {} : { storage: PILOT_STORAGE });
    setSession(next);
    runRef.current = next.run;
    setRun(next.run);
    setHistory(openNight(next.run, next.refillRng));
    setView({ board: next.run.board, stages: [], deal: next.fresh });
    afterDawnRef.current = null;
    setAfterDawn(null);
    setOverDismissed(false);
    setBloodInFlight(0);
    setClearToken((token) => token + 1);
    const { settings } = next.save;
    setSpeed(settings.speed);
    setSound(settings.sound);
    setGuideSeen(settings.guideSeen);
    setTips(settings.tips);
    setConfirmToss(settings.confirmToss);
    setTutorialDone(settings.tutorialDone);
    beatRef.current = null;
    setBeatIndex(null);
    savedAtRef.current = next.save.savedAt;
    contentRef.current = null;
    nightRef.current = next.run.night;
  }, [setHistory]);

  /**
   * Сверка с облаком — при запуске и после входа в аккаунт. Облако новее, а
   * здесь ещё не играли — поднимаемся из него; иначе в облако уходит местный.
   */
  const syncCloud = useCallback(async () => {
    cloudSyncedRef.current = false;
    if (platform.getPlayerMode() === 'authorized') {
      const raw = await platform.loadData<unknown>();
      const cloud = raw === null ? null : loadSave(raw);
      const local = loadSave(snapshotRef.current).save;
      const usable = cloud !== null && !cloud.recovered ? cloud.save : null;
      if (chooseSave(local, usable, touchedRef.current) === 'cloud') {
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
        storage.write(STORAGE_KEY, text);
        adoptSaved();
        // Снимок ещё старый, местный: до перерисовки в облако не пишем ничего,
        // иначе он затёр бы только что взятый облачный сейв.
        snapshotRef.current = text;
        cloudSyncedRef.current = true;
        return;
      }
    }
    cloudSyncedRef.current = true;
    cloudGate.request(snapshotRef.current, Date.now());
  }, [adoptSaved, cloudGate, platform, storage]);

  useEffect(() => {
    if (platformInited) void syncCloud();
    // Сверка — при подъёме площадки и после каждого входа, а не на каждую
    // новую версию функции.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformInited, signIns]);

  // Новый забег — естественная пауза: если подошли 10 минут, реклама — здесь.
  // Забег начинается по любому её исходу.
  const restart = useCallback(() => {
    void fullscreenIfDue().then(restartNow);
  }, [fullscreenIfDue, restartNow]);

  const closeRunOver = useCallback(() => {
    setOverDismissed(true);
  }, []);

  // Ремонт цитадели за ролик — один раз за сессию: пала повторно — ролика уже
  // нет. После ремонта забег идёт дальше со следующей ночи, как будто замок
  // устоял.
  const [repairing, setRepairing] = useState(false);
  const [repairUsed, setRepairUsed] = useState(false);
  const handleRepair = useCallback(() => {
    setRepairing(true);
    void runAd(() => watchRewarded(platform, PLATFORM_CONFIG.rewardedPlacement))
      .then((watched) => {
        if (!watched || !canRepair(runRef.current)) return;
        setRepairUsed(true);
        const repaired = repairCitadel(runRef.current, CITADEL_CONFIG.startHearts);
        runRef.current = repaired;
        setRun(repaired);
        setOverDismissed(false);
        setHistory(openNight(repaired, refillRng));
        // Со стен смываем, кто остался с проигранного боя: ночь начинается заново.
        setClearToken((token) => token + 1);
      })
      .finally(() => {
        setRepairing(false);
      });
  }, [platform, refillRng, runAd, setHistory]);

  const bossLane = over ? null : session.bossLane(run.night);
  // Отсчёт до босса — цель ночей, как «The mother of dragons is coming in N
  // days» в оригинале. Боссы кончились — отсчёта нет.
  const bossNight = over ? null : nextBossNight(BOSS_CONFIG, run.night);
  const bossIn = bossNight === null ? null : bossNight - run.night;
  // Подсказка к первой встрече — после обучения, когда поле спокойно и
  // ничего не открыто.
  const tip: TipId | null =
    beat === undefined && !atDawn && !over && settled && !guideOpen && !recordsOpen
      ? nextTip(run.board, tips)
      : null;
  // Напоминание о Проповеднике — в начале каждой его ночи, а не раз за игру:
  // полосу нужно успеть укрепить до рассвета.
  const bossReminder =
    bossLane !== null &&
    bossNoticeNight !== run.night &&
    beat === undefined &&
    !atDawn &&
    !over &&
    settled &&
    !guideOpen &&
    !recordsOpen;
  // Выходной предлагают в самом начале ночи, пока не сделано ни хода.
  const dayOffOffer =
    canTakeDayOff(run, ECONOMY_CONFIG.dayOffEvery) &&
    dayOffAsked !== run.night &&
    !canUndo(history) &&
    beat === undefined &&
    !atDawn &&
    !over &&
    settled &&
    victory === null &&
    !guideOpen &&
    !recordsOpen;

  // Бот сам закрывает карточки: победа, напоминание о боссе, подсказка.
  const pilotDismiss = dayOffOffer
    ? declineDayOff
    : victory !== null
      ? () => {
          setVictory(null);
        }
      : bossReminder
        ? () => {
            setBossNoticeNight(run.night);
          }
        : tip !== null
          ? () => {
              dismissTip(tip);
            }
          : null;
  useBotPilot({
    config: pilot,
    run,
    options,
    bossLane,
    ready: settled && !atDawn && !over && inspect === null && tossAsk === null,
    play,
    dismiss: pilotDismiss,
  });

  const bossArrival = BOSS_CONFIG.nights.indexOf(run.night);
  const coach = coachFor(beat, layout, undoButton);
  const beatText = beat === undefined ? null : textOfBeat(beat.id);

  const current = recordOf(run.stats, SCORE_CONFIG.weights);
  const isRecord = current.score > 0 && current.score > bestOf(session.save.best, level.id).score;

  return (
    <>
      <Water day={atDawn} durationMs={DAYLIGHT_MS / speed} />
      <div className={styles.screen}>
        <header className={styles.header}>
          <dl className={styles.stats}>
            <div className={styles.stat} title={t('app.citadelHearts')}>
              <dt
                key={liveHearts?.hit ?? 0}
                className={liveHearts === null ? undefined : styles.hurt}
              >
                <Icon name="heart" size={18} className={styles.heart} />
                <span className={styles.hidden}>{t('app.hearts')}</span>
              </dt>
              <dd>{atDawn && liveHearts !== null ? liveHearts.hearts : run.citadel.hearts}</dd>
            </div>
            <div className={styles.stat} title={t('app.night')}>
              <dt>
                <Icon name="moon" size={18} className={styles.moon} />
                <span className={styles.hidden}>{t('app.night')}</span>
              </dt>
              <dd>{run.night}</dd>
            </div>
          </dl>

          <nav className={styles.menu}>
            <button
              className={styles.round}
              type="button"
              title={t('app.chronicle')}
              aria-label={t('app.chronicle')}
              onClick={openRecords}
            >
              <Icon name="scroll" />
            </button>
            {!over && beat === undefined && (
              <button
                className={styles.round}
                type="button"
                disabled={atDawn}
                title={t('app.giveUp')}
                aria-label={t('app.giveUp')}
                onClick={() => {
                  setGiveUpAsk(true);
                }}
              >
                <Icon name="flag" />
              </button>
            )}
            <button
              className={styles.round}
              type="button"
              title={t('app.howToPlay')}
              aria-label={t('app.howToPlay')}
              onClick={() => {
                setGuideOpen(true);
              }}
            >
              <Icon name="help" />
            </button>
            <SoundControl
              settings={sound}
              fallback={{ ...AUDIO_CONFIG.volumes, muted: false }}
              onChange={setSound}
              toggles={[
                {
                  label: t('app.askBeforeThrowingA'),
                  on: confirmToss,
                  onChange: setConfirmToss,
                },
              ]}
            />
            <LanguageSelect current={lang} onPick={changeLang} />
          </nav>
        </header>

        <BoardView
          view={view}
          battle={battle}
          audio={audio}
          onBattleEnd={handleBattleEnd}
          speed={speed}
          quality={quality}
          skipToken={skipToken}
          clearToken={clearToken}
          daylight={atDawn}
          paused={paused}
          reserveBottom={reserveBottom}
          onSwap={handleSwap}
          onTap={handleTap}
          onInspect={handleInspect}
          onEdge={handleEdge}
          turrets={turrets}
          bossLane={bossLane}
          attackZone={zoneView}
          onLayout={setLayout}
          onBoss={setBossHp}
          onHearts={handleHearts}
          onStagesDone={handleStagesDone}
          onBlood={handleBlood}
          onReady={handleSceneReady}
        >
          {bossIn !== null && (
            <div className={bossIn === 0 ? styles.bossChipNow : styles.bossChip} role="status">
              {bossIn === 0
                ? t('app.thePreacherComesTonight')
                : t('app.preacherIn', {
                    count: bossIn,
                    nights: t('plural.nights', { count: bossIn }),
                  })}
            </div>
          )}
          <div className={styles.controls}>
            <div className={styles.speed} role="group" aria-label={t('app.battleSpeed')}>
              <button
                className={speed === 1 ? styles.segOn : styles.seg}
                type="button"
                aria-pressed={speed === 1}
                onClick={() => setSpeed(1)}
              >
                1×
              </button>
              <button
                className={speed === 2 ? styles.segOn : styles.seg}
                type="button"
                aria-pressed={speed === 2}
                onClick={() => setSpeed(2)}
              >
                2×
              </button>
              <button
                className={styles.seg}
                type="button"
                title={t('app.skipBattle')}
                aria-label={t('app.skipBattle')}
                onClick={() => setSkipToken((token) => token + 1)}
              >
                <Icon name="skip" size={16} />
              </button>
            </div>
            {/* Отмена хода — под скоростью, в правом верхнем углу. */}
            {/* Отмена — как в оригинале: видна всегда, а когда отменить нельзя,
                полупрозрачна и по нажатию объясняет почему. */}
            {!over && (
              <button
                ref={setUndoButton}
                className={undoable ? styles.undo : styles.undoOff}
                type="button"
                aria-disabled={!undoable}
                title={t('app.undoMove')}
                aria-label={t('app.undoMove')}
                onClick={undoable ? undoMove : explainUndo}
              >
                <Icon name="undo" />
              </button>
            )}
          </div>
        </BoardView>

        <footer className={styles.footer} ref={footerRef}>
          {over ? (
            <button className={styles.restart} type="button" onClick={restart}>
              {t('app.startOver')}
            </button>
          ) : (
            <>
              {notice !== null && (
                <div className={styles.notice} key={notice.key} role="status">
                  {notice.text}
                </div>
              )}
              {bonus !== null && (
                <div className={styles.bonus} key={bonus.key} role="status">
                  <b>{bonus.title}</b>
                  <span>{bonus.detail}</span>
                </div>
              )}
              {run.dayOff === true ? (
                <div className={styles.dayOff}>
                  <p>{t('dayOff.caption')}</p>
                  <button className={styles.restart} type="button" onClick={finishRearrange}>
                    {t('dayOff.done')}
                  </button>
                </div>
              ) : atDawn && bossHp !== null ? (
                <BossBar hp={bossHp.hp} max={bossHp.max} hit={bossHp.hit} />
              ) : (
                <BloodMeter
                  swaps={atDawn ? 0 : Math.max(0, run.purse.swaps - bloodInFlight)}
                  perNight={ECONOMY_CONFIG.swapsPerNight}
                />
              )}
            </>
          )}
        </footer>

        {recordsOpen && (
          <RecordsPanel view={records} onSignIn={handleSignIn} onClose={closeRecords} />
        )}

        {over && !overDismissed && (
          <RunOverPanel
            nights={current.nights}
            score={current.score}
            isRecord={isRecord}
            onRepair={
              canRepair(run) && !repairUsed && platformReady && platform.isRewardedAvailable()
                ? handleRepair
                : undefined
            }
            repairing={repairing}
            onRestart={restart}
            onClose={closeRunOver}
          />
        )}

        {coach !== null && beatText !== null && (settled || coach.hole === null) && (
          <Coach
            hole={coach.hole}
            gesture={coach.gesture}
            {...(coach.from !== undefined && { from: coach.from })}
            {...(coach.to !== undefined && { to: coach.to })}
            title={beatText.title}
            text={beatText.text}
          />
        )}

        {beat !== undefined && isCard(beat) && beatText !== null && settled && (
          <TipCard
            {...('frame' in beat && { frame: beat.frame })}
            title={beatText.title}
            text={beatText.text}
            low={zoneView !== null}
            onDismiss={dismissTutorialCard}
          />
        )}

        {victory !== null && (
          <TipCard
            frame="preacher-1"
            title={
              victory.next === null
                ? t('app.victory.lastTitle')
                : t('app.victory.title', { night: victory.night })
            }
            text={
              victory.next === null
                ? t('app.victory.lastText')
                : t('app.victory.text', { next: victory.next })
            }
            note={t('app.victory.points', { points: SCORE_CONFIG.weights.boss })}
            onDismiss={() => {
              setVictory(null);
            }}
          />
        )}

        {inspect !== null && (
          <TipCard
            frame={inspect.frame}
            title={inspect.title}
            text={inspect.text}
            note={inspect.stats}
            low={zoneView !== null}
            onDismiss={() => {
              setInspect(null);
              setInspectAt(null);
            }}
          />
        )}

        {bossReminder && inspect === null && victory === null && (
          <TipCard
            frame="preacher-1"
            title={t('boss.reminder.title')}
            text={
              bossArrival > 0
                ? t('boss.reminder.stronger', {
                    hp: Math.round(statsAt(specFor(ENEMY_BOOK, 'preacher'), run.night).hp),
                  })
                : t('boss.reminder.first')
            }
            onDismiss={() => {
              setBossNoticeNight(run.night);
            }}
          />
        )}

        {tip !== null && inspect === null && victory === null && !bossReminder && !dayOffOffer && (
          <TipCard
            frame={tipFrame(tip)}
            title={tipText(tip).title}
            text={tipText(tip).text}
            onDismiss={() => {
              dismissTip(tip);
            }}
          />
        )}

        {dayOffOffer && inspect === null && (
          <ConfirmSheet
            title={t('dayOff.title')}
            text={t('dayOff.text')}
            frame="gargoyle-crimson"
            actions={[
              { label: t('dayOff.take'), onClick: takeDayOff },
              { label: t('dayOff.skip'), onClick: declineDayOff },
            ]}
            onClose={declineDayOff}
          />
        )}

        {tossAsk !== null && (
          <ConfirmSheet
            title={t('app.throwTheBuildingAway')}
            text={t('app.itWillBeGone')}
            frame={tossAsk.frame}
            actions={[
              { label: t('app.throwAway'), onClick: toss },
              {
                label: t('app.keepIt'),
                onClick: () => {
                  setTossAsk(null);
                },
              },
            ]}
            onClose={() => {
              setTossAsk(null);
            }}
          />
        )}

        {giveUpAsk && (
          <ConfirmSheet
            title={t('app.giveUpTitle')}
            text={t('app.theRunEndsNow')}
            actions={[
              { label: t('app.giveUp'), onClick: surrender },
              {
                label: t('app.keepPlaying'),
                onClick: () => {
                  setGiveUpAsk(false);
                },
              },
            ]}
            onClose={() => {
              setGiveUpAsk(false);
            }}
          />
        )}

        {guideOpen && <GuidePanel onClose={closeGuide} />}
      </div>
    </>
  );
}
