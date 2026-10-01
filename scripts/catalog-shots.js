/**
 * Скриншоты для карточки игры на Яндексе — сырые кадры.
 *
 *   npm run build && npx vite preview --port 4790
 *   PLAYWRIGHT=<путь к playwright/index.mjs> node scripts/catalog-shots.js <phone|desktop> <ru|en>
 *   python3 scripts/catalog-screens.py
 *
 * Кадры — в `art/catalog/screens/<язык>/raw/<вид>-NN-<что>.png`; готовые 16:9
 * из них собирает catalog-screens.py. Телефон снимается в 2× от 1080 × 1920
 * (2160 × 3840): catalog-screens.py всё равно уменьшает его, и с запасом края
 * и текст глаже. Потолок плотности канваса в игре поднят параметром density
 * (shared/phaser/createGame), иначе кадр рисовался бы мельче и растягивался.
 */
import { mkdirSync } from 'node:fs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const [mode = 'phone', LANG = 'ru'] = process.argv.slice(2);
const phone = mode === 'phone';
const URL = `http://localhost:4790/?lang=${LANG}${phone ? '&density=6' : ''}`;
const OUT = `art/catalog/screens/${LANG}/raw`;
mkdirSync(OUT, { recursive: true });

const TIPS = ['gargoyle', 'vine', 'mortar', 'fogveil', 'potion', 'turret', 'boss'];
const R = { S: 'stone', T: 'thorn', A: 'ash', F: 'fog', B: 'blood' };
const K = { g: 'gargoyle', v: 'vine', m: 'mortar', f: 'fogveil' };
const TI = { r: 'raw', b: 'bone', o: 'obsidian', c: 'crimson' };
const cell = (c) =>
  c.length === 1
    ? { kind: 'tile', resource: R[c] }
    : c[0] === 'P'
      ? { kind: 'potion', tier: TI[c[1]] }
      : { kind: 'building', building: K[c[0]], tier: TI[c[1]] };
// Поле посреди игры: постройки всех видов и ступеней.
const RICH = [
  ['A', 'gb', 'T', 'T', 'gb', 'S'],
  ['vo', 'S', 'mc', 'B', 'Pb', 'vb'],
  ['T', 'go', 'A', 'fo', 'go', 'A'],
  ['mb', 'F', 'vc', 'gc', 'F', 'mo'],
  ['B', 'fb', 'S', 'A', 'fr', 'B'],
  ['F', 'T', 'gr', 'vr', 'S', 'T'],
];
// Поле, где три свапа подряд дают комбо (то же, что в ролике).
const COMBO = [
  ['gc', 'B', 'A', 'go', 'B', 'gc'],
  ['vb', 'A', 'T', 'F', 'T', 'B'],
  ['mo', 'F', 'A', 'B', 'S', 'T'],
  ['A', 'A', 'F', 'fo', 'F', 'T'],
  ['gc', 'T', 'S', 'T', 'B', 'vc'],
  ['gr', 'gr', 'T', 'S', 'S', 'mc'],
];

const browser = await chromium.launch({
  args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const ctx = await browser.newContext(
  phone
    ? { viewport: { width: 405, height: 720 }, deviceScaleFactor: (1080 / 405) * 2 }
    : { viewport: { width: 1920, height: 1080 } },
);
// Сейв подкладывается до запуска игры: если писать его в уже открытую, она
// перезапишет его своим при выгрузке страницы.
await ctx.addInitScript(() => {
  const st = sessionStorage.getItem('pending');
  if (st === null) return;
  sessionStorage.removeItem('pending');
  if (st === 'clear') localStorage.clear();
  else localStorage.setItem('bagrovaya-citadel', st);
});
const p = await ctx.newPage();
// Время игры стоит и идёт только в wait(): кадр телефона в 2× снимается долго,
// и на живых часах бой успевал уйти вперёд — «бой с боссом» выходил уже
// победой. CSS-анимации часами не управляются — им shot() даёт доиграть.
await p.clock.pauseAt(Date.now());
const wait = (ms) => p.clock.runFor(ms);
await p.goto(URL);
await wait(3000);

const tower = (tier) => ({
  cell: { kind: 'building', building: 'gargoyle', tier },
  facing: 'down',
});

async function closeDialogs() {
  for (let i = 0; i < 3; i++) {
    const d = p.locator('[role=dialog] button');
    if (!(await d.count())) return;
    await d.last().click();
    await wait(500);
  }
}

async function setup({ night = 7, layout = RICH, fresh = false } = {}) {
  await p.evaluate(
    ({ night, cells, fresh, TIPS, NESTS }) => {
      if (fresh) {
        sessionStorage.setItem('pending', 'clear');
        return;
      }
      const s = JSON.parse(localStorage.getItem('bagrovaya-citadel'));
      s.run.night = night;
      s.run.hearts = 5;
      s.run.board.cells = cells;
      s.run.nests = NESTS;
      s.run.rng = { seed: 777, state: 777 };
      s.settings = { ...s.settings, tutorialDone: true, tips: TIPS, speed: 1 };
      sessionStorage.setItem('pending', JSON.stringify(s));
    },
    {
      night,
      cells: layout.flat().map(cell),
      fresh,
      TIPS,
      NESTS: { left: tower('crimson'), right: tower('obsidian') },
    },
  );
  await p.reload();
  await wait(3500);
  if (!fresh) await closeDialogs();
}

const at = phone
  ? (x, y) => ({ x: 83 + 48 * x, y: 220 + 48 * y })
  : (x, y) => ({ x: 755 + 82 * x, y: 377 + 82 * y });

async function swipe(a, c, after = 1400) {
  const A = at(...a);
  const C = at(...c);
  await p.mouse.move(A.x, A.y);
  await p.mouse.down();
  await p.mouse.move(C.x, C.y, { steps: 5 });
  await p.mouse.up();
  await wait(after);
}

/** Потратить всю кровь: дальше наступает рассвет и бой. */
async function spend() {
  for (let i = 0; i < 5; i++) await swipe([0, 4], [0, 5], 900);
}

async function shot(n, name) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/${mode}-${String(n).padStart(2, '0')}-${name}.png` });
}

await setup();
await shot(1, 'night');
await spend();
await wait(3000);
await shot(2, 'battle');

await setup({ night: 10 });
await spend();
await wait(3000);
await shot(3, 'boss');
await wait(1500);
await shot(4, 'boss-fight');
for (let i = 0; i < 40 && !(await p.locator('[role=dialog]').count()); i++) {
  await wait(500);
}
await wait(600);
await shot(5, 'victory');

await setup({ layout: COMBO });
await swipe([2, 2], [2, 3]);
await swipe([4, 1], [5, 1]);
await swipe([2, 4], [2, 5], 1150);
await shot(6, 'combo');

await setup();
{
  // Долгое нажатие на клетку — карточка постройки.
  const A = at(3, 3);
  await p.mouse.move(A.x, A.y);
  await p.mouse.down();
  await wait(900);
  await shot(7, 'inspect');
  await p.mouse.up();
}

await setup();
await p
  .getByRole('button', { name: LANG === 'ru' ? /как играть/i : /how to play/i })
  .first()
  .click();
await wait(900);
await shot(8, 'guide');

await setup({ fresh: true });
await wait(1200);
await shot(9, 'tutorial');
await swipe([0, 1], [0, 0], 2200);
await shot(10, 'tutorial-gargoyle');

console.log(OUT, mode, 'done');
await browser.close();
