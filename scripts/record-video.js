/**
 * Видео для карточки игры на Яндексе — покадровая запись.
 *
 * Часы страницы подменяются (Playwright clock): игра шагает ровно на 1/60
 * секунды, после каждого шага снимается кадр без сжатия. Так ролик не дёргается,
 * даже если браузер не успевает рисовать в реальном времени. CSS-анимации
 * подменой часов не управляются — их замедляем через CDP под тот же шаг.
 * Рендер идёт в 2× от итогового размера, ffmpeg потом уменьшает — это
 * сглаживает края и текст (суперсэмплинг).
 *
 *   npm run build && npx vite preview --port 4790
 *   PLAYWRIGHT=<путь к playwright/index.mjs> node scripts/record-video.js <ru|en> <desktop|phone>
 *   sh scripts/encode-video.sh <ru|en> <desktop|phone>
 *
 * Кадры — в `.video/<язык>-<вид>/`, готовые ролики — в `art/catalog/video/`.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const LANG = process.argv[2] ?? 'ru';
const DESK = (process.argv[3] ?? 'desktop') === 'desktop';
// Телефон снимается в 5⅓× (2× от 1080 × 1920): потолок плотности канваса в игре
// — 2, параметр density его поднимает (shared/phaser/createGame).
const URL = `http://localhost:4790/?lang=${LANG}${DESK ? '' : '&density=6'}`;
const OUT = `.video/${LANG}-${DESK ? 'desktop' : 'phone'}`;
const FPS = 60;
const STEP = 1000 / FPS;
// Сколько реального времени отводится на кадр: под него замедляются CSS-анимации.
const REAL_STEP = 1000;

const TIPS = ['gargoyle', 'vine', 'mortar', 'fogveil', 'potion', 'turret', 'boss'];
const R = { S: 'stone', T: 'thorn', A: 'ash', F: 'fog', B: 'blood' };
const K = { g: 'gargoyle', v: 'vine', m: 'mortar', f: 'fogveil' };
const TI = { r: 'raw', b: 'bone', o: 'obsidian', c: 'crimson' };
const cell = (c) =>
  c.length === 1
    ? { kind: 'tile', resource: R[c] }
    : { kind: 'building', building: K[c[0]], tier: TI[c[1]] };
const BOARD = [
  ['gc', 'B', 'A', 'go', 'B', 'gc'],
  ['vb', 'A', 'T', 'F', 'T', 'B'],
  ['mo', 'F', 'A', 'B', 'S', 'T'],
  ['A', 'A', 'F', 'fo', 'F', 'T'],
  ['gc', 'T', 'S', 'T', 'B', 'vc'],
  ['gr', 'gr', 'T', 'S', 'S', 'mc'],
]
  .flat()
  .map(cell);

const browser = await chromium.launch({
  args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});

// Сейв: десятая ночь, ночь Проповедника, обучение пройдено.
const prep = await (await browser.newContext({ viewport: { width: 405, height: 720 } })).newPage();
await prep.goto(URL);
await prep.waitForTimeout(3000);
const state = await prep.evaluate(
  ({ BOARD, TIPS }) => {
    const s = JSON.parse(localStorage.getItem('bagrovaya-citadel'));
    s.run.night = 10;
    s.run.hearts = 5;
    s.run.board.cells = BOARD;
    s.run.rng = { seed: 777, state: 777 };
    s.run.nests = {
      left: { cell: { kind: 'building', building: 'gargoyle', tier: 'crimson' }, facing: 'down' },
      right: { cell: { kind: 'building', building: 'gargoyle', tier: 'obsidian' }, facing: 'down' },
    };
    s.settings = { ...s.settings, tutorialDone: true, tips: TIPS, speed: 1 };
    return JSON.stringify(s);
  },
  { BOARD, TIPS },
);

const ctx = await browser.newContext(
  DESK
    ? { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 }
    : { viewport: { width: 405, height: 720 }, deviceScaleFactor: (1080 / 405) * 2 },
);
await ctx.addInitScript((st) => localStorage.setItem('bagrovaya-citadel', st), state);
const page = await ctx.newPage();
// Именно pauseAt, не install: после install подменённые часы идут сами, и за
// реальное ожидание между кадрами игра убегала вперёд — вода, облака и твины
// в ролике неслись. На паузе время идёт только в runFor.
await page.clock.pauseAt(Date.now());
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let frame = 0;
let recording = false;
// Кадры, снятые дольше REAL_STEP: на них CSS-анимации чуть спешат.
let late = 0;

/** Один кадр: часы вперёд на 1/60 секунды, снимок, добивка реального времени. */
async function tick() {
  const started = Date.now();
  await page.clock.runFor(STEP);
  if (recording) {
    // Снимок Playwright — в пикселях устройства (2×); голый CDP отдал бы 1×.
    writeFileSync(`${OUT}/${String(frame++).padStart(5, '0')}.png`, await page.screenshot());
  }
  const spent = Date.now() - started;
  if (recording && spent > REAL_STEP) late++;
  else if (recording) await new Promise((r) => setTimeout(r, REAL_STEP - spent));
}

async function wait(seconds) {
  for (let i = 0; i < Math.round(seconds * FPS); i++) await tick();
}

const at = DESK
  ? (x, y) => ({ x: 755 + 82 * x, y: 377 + 82 * y })
  : (x, y) => ({ x: 83 + 48 * x, y: 220 + 48 * y });

/**
 * Свап пальцем. Движение — одним вызовом, между кадрами его не дробить: так
 * Phaser свайп не засчитывает и принимает за тап (открывается карточка клетки).
 * Плитка за пальцем не едет — игра меняет её по порогу свайпа, — так что на
 * картинке разницы нет.
 */
async function swipe(a, c, after = 1.5) {
  const A = at(...a);
  const C = at(...c);
  await page.mouse.move(A.x, A.y);
  await page.mouse.down();
  await page.mouse.move(C.x, C.y, { steps: 5 });
  await page.mouse.up();
  await wait(after);
}

await page.goto(URL, { waitUntil: 'load' });
await wait(4);
const reminder = page.locator('[role=dialog] button');
if (await reminder.count()) {
  await reminder.last().click();
  await wait(1);
}
// Дать CSS-анимациям (закрытие окна) доиграть в реальном времени, потом
// замедлить их под шаг кадра.
await page.waitForTimeout(1500);
await cdp.send('Animation.setPlaybackRate', { playbackRate: STEP / REAL_STEP });

recording = true;
await wait(0.8);
await swipe([2, 2], [2, 3]);
await swipe([4, 1], [5, 1]);
await swipe([2, 4], [2, 5], 2.2);
await swipe([0, 0], [1, 0]);
await swipe([2, 0], [3, 0]);
await swipe([0, 1], [1, 1], 0.8);
// Бой — до итогов ночи и ещё три секунды на них.
for (let i = 0; i < 60; i++) {
  await wait(0.5);
  if (await page.locator('[role=dialog]').count()) break;
}
await wait(3);

console.log(OUT, 'frames', frame, 'late', late, 'seconds', (frame / FPS).toFixed(1));
await browser.close();
