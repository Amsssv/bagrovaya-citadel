/**
 * ⚠️ ТОЛЬКО ДЛЯ ЛОКАЛЬНОГО ПРОСМОТРА. Арт оригинала (Tower Swap) — чужой, в
 * сборку и в репозиторий он не идёт; дизайнер заменит его своим.
 *
 * Скрипт читает координаты кадров из бандла оригинала и пишет
 * `original/atlas.json` — рядом с атласом `original/texture.png`. Вся папка
 * `original/` в .gitignore. Формат — тот же, что у атласа дизайнера
 * (docs/atlas.md). Игра подхватывает этот атлас только в dev-сервере и только
 * по `?art=original` — для сравнения; по умолчанию — атлас дизайнера
 * (widgets/board/atlasArt.ts).
 *
 * Запуск: node scripts/original-atlas.js
 */
import { readFileSync, writeFileSync } from 'node:fs';

const bundle = readFileSync('original/original.js', 'utf8');

// Таблица кадров — подряд идущие вызовы imageaddgl(x, y, w, h) от первого кадра
// до первого цикла: номер вызова и есть индекс кадра в оригинале.
const start = bundle.indexOf('ea.imageaddgl(436, 750, 23, 23)');
if (start < 0) throw new Error('Не нашёл таблицу кадров в original/original.js');
const table = bundle.slice(start, bundle.indexOf('for (var', start));
// Числа бывают и в записи вида 1e3 — минификатор так пишет тысячу.
const NUM = '([\\d.e]+)';
const CALL = new RegExp(`imageaddgl\\(${NUM}, ${NUM}, ${NUM}, ${NUM}\\)`, 'g');
const rects = [...table.matchAll(CALL)].map((m) => m.slice(1, 5).map(Number));

const TIERS = ['raw', 'bone', 'obsidian', 'crimson'];

/** Наше имя кадра → индекс кадра в оригинале. */
const named = {
  'tile-stone': 296,
  'tile-thorn': 332,
  'tile-ash': 316,
  'tile-fog': 321,
  'tile-blood': 317,
};
const byTier = {
  gargoyle: [187, 307, 69, 3],
  vine: [400, 403, 405, 407],
  mortar: [201, 204, 205, 206],
  fogveil: [320, 247, 248, 249],
  potion: [305, 298, 379, 113],
};
for (const [kind, indices] of Object.entries(byTier)) {
  indices.forEach((index, tier) => {
    named[`${kind}-${TIERS[tier]}`] = index;
  });
}
// Снаряды по ступеням: стрела, болт баллисты, ядро пушки; взрыв и тень ядра.
const shots = {
  'shot-gargoyle': [0, 106, 56, 107],
  'shot-vine': [2, 58, 59, 258],
  'shot-mortar': [64, 111, 109, 108],
};
for (const [kind, indices] of Object.entries(shots)) {
  indices.forEach((index, tier) => {
    named[`${kind}-${TIERS[tier]}`] = index;
  });
}
named['shot-explosion'] = 63;
named['shot-shadow'] = 66;
// Облака под полем: задняя полоса, серая, и передняя, белая.
named['cloud-back'] = 228;
named['cloud-front'] = 227;

const anims = {
  hunter: [7, 8, 9, 8],
  preacher: [60, 568, 567, 568, 60, 61, 62, 61],
};
for (const [kind, indices] of Object.entries(anims)) {
  indices.forEach((index) => {
    named[`${kind}-${String(index)}`] = index;
  });
}

const frames = {};
for (const [name, index] of Object.entries(named)) {
  const rect = rects[index];
  if (rect === undefined) throw new Error(`Нет кадра ${String(index)} для «${name}»`);
  frames[name] = rect;
}

// Эффекты добавляются в оригинале циклами уже после таблицы, поэтому берём
// их по координатам: облако гибели дракона и шесть кадров пламени.
frames['fx-death'] = [290, 750, 31, 24];
const fire = [];
for (let e = 0; e < 6; e++) {
  frames[`fx-fire-${String(e + 1)}`] = [465 + 45 * e, 958, 44, 66];
  fire.push(`fx-fire-${String(e + 1)}`);
}

const out = {
  // Клетка оригинала — 48 точек: весь его арт нарисован под неё.
  cell: 48,
  frames,
  anims: {
    ...Object.fromEntries(
      Object.entries(anims).map(([kind, indices]) => [
        kind,
        indices.map((index) => `${kind}-${String(index)}`),
      ]),
    ),
    'fx-fire': fire,
  },
};
writeFileSync('original/atlas.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(
  `original/atlas.json: ${String(Object.keys(frames).length)} кадров из ${String(rects.length)}`,
);
