# Промты для генерации арта

Промты для ChatGPT (генерация картинок), по которым рисуется арт игры. Файл
живой: новый лист — новый раздел, удачная правка промта — сюда же, с пометкой,
что она исправила.

Готовые листы кладутся в `art/atlas/` (исходники, в сборку не идут) и
нарезаются в атлас скриптом `scripts/build-atlas.py` → `src/shared/assets/atlas/`
(формат и список кадров — `docs/atlas.md`).

## Как работать

- **Прикладывать как образец стиля** `src/shared/assets/board/castle.webp` и
  `field.webp` — это наш арт.
- **Не прикладывать** `original/texture.png` и любой другой арт Tower Swap:
  «перерисуй вот это» даёт производную работу от чужого арта, и с правами у неё
  та же беда, что у оригинала. Предметы описываются словами.
- Один лист — одно сообщение, но все листы — **в одном чате**: так стиль между
  ними держится лучше.
- Промты — на английском: генератор картинок понимает его лучше.
- Общий блок стиля вставляется **в начало каждого** запроса.
- Сетку ChatGPT держит неточно (просили 1024×768 — пришло 1448×1086), это не
  страшно: скрипт режет по пустым полосам между спрайтами, а не по сетке. Важно
  только, чтобы спрайты не касались друг друга и шли в заданном порядке.

### Если вышло не то

- Ступени построек похожи друг на друга:
  *«Tiers must differ in silhouette: make Bone taller with spikes, Obsidian sharp
  and glassy, Crimson the tallest with a crown»*.
- Сетка поехала или спрайты слиплись:
  *«Keep the same sprites, but place them exactly on the grid, one per cell,
  bottom-aligned, with empty magenta space between them»*.
- Облака не повторяются без шва — скрипт это правит сам (ищет столбец, где
  правый край совпадает с левым, и сглаживает стык), но лучше попросить:
  *«The strip must tile seamlessly: the rightmost column continues exactly into
  the leftmost one»*.

---

## Второй прогон — текущий

Что не так с первым прогоном (2026-09-28) и что меняем:

1. **Слишком тёмные.** Тела предметов — из самых тёмных цветов палитры, и на
   тёмном поле и воде они сливаются. Теперь: тела в средних и светлых тонах,
   почти чёрный — только контур и глубокие тени, у каждого предмета светлая
   кромка сверху-слева и один яркий акцент.
2. **Нельзя анимировать.** Каждый предмет был одной картинкой. Теперь: то, что
   двигается, — **отдельно** (ствол мортиры, туман завесы) или **по кадрам**
   (атака горгульи, пасть лозы, питьё потира, ходьба и гибель врагов,
   попадания).

Имена кадров в каждом листе — те, под которыми они лягут в атлас
(`docs/atlas.md` → «Кадры анимаций»). Скрипт `scripts/build-atlas.py` под
новые листы допишем, когда они придут.

### Общий блок стиля (второй прогон)

```
Style reference: the attached castle and field images — match their pixel-art style,
but the sprites must be BRIGHTER than the environment so they read clearly on top of it.

Pixel art: top-down 3/4 view, chunky pixels (each sprite reads as ~32×32 pixel-art
upscaled with hard nearest-neighbour edges, no anti-aliasing, no blur).

Readability rules (most important):
- The sprites will sit on a dark purple ground #462d4a and dark violet water #2f1060.
  They must POP against both: average brightness of every sprite clearly above the
  background.
- Body colours from the mid and light ramp: stone #8e7aa3 #b6a4c8 #d9cde4,
  bone #efe4ea #fff6f8, iron #9aa3b8, gold #f2c14e #ffe08a.
- Near-black (#1b173a and darker) ONLY for the 1-px outline and the deepest shadow.
- Every sprite has a light rim highlight on its top-left edges (#fff1f5 or #ffd7de).
- One strong accent per sprite: crimson glow #ff3b55 / #ff0926, or gold, or violet magic
  #c38bff — the accent tells tiers and kinds apart at a glance on a phone.
- Silhouettes must be readable when the sprite is 48 px tall.

Theme: "Crimson Citadel" — a vampire lord's castle defending against the Order of Dawn.
Carved stone, wrought iron, bone, crimson glass, candle glow. Gothic, not cute.

Animation rules:
- Frames of one animation: identical size, position, scale, colours and outline; only the
  moving part changes. The base of the object stays on exactly the same pixels.
- Parts marked "SEPARATE" are drawn alone in their own cell, not attached to the body.

Sheet rules:
- Solid pure magenta background #FF00FF everywhere except the sprites. No shadows or glow
  on the background, no texture, no frame, no grid lines, no labels, no text.
- One sprite per cell, centred horizontally, standing on the BOTTOM edge of its cell
  (projectiles and effects: centred in the cell).
- Empty magenta space between sprites — they must never touch.
```

Лишь бы не слилось: готовый лист перед тем, как класть в проект, открыть на
фоне `#462d4a` — предметы должны читаться с первого взгляда.

### Лист A — плитки

Файл: `art/atlas/v2/a-tiles.png`. Кадры: `tile-stone`, `tile-thorn`,
`tile-ash`, `tile-fog`, `tile-blood`.

```
Image 1280×256. Grid 5 columns × 1 row, cells 256×256. Each tile is a compact object
filling ~85% of the cell, bright and readable:
 1. Grave stone: a pale weathered tombstone (#b6a4c8 / #d9cde4) with a glowing crimson
    cross carved in it and two small red candles at its foot.
 2. Blood thorn: a knot of bright crimson thorny bramble (#d6334a / #ff3b55) with pale
    highlights on the thorns.
 3. Ancestral ash: a bone-white funeral urn (#efe4ea) spilling light grey ash, a crimson
    rune on its side.
 4. Grave fog: a swirling wisp of bright lilac mist (#c38bff / #e2c8ff) with two glowing
    white eyes.
 5. Blood: a glossy bright-red drop (#ff3b55) with a white shine and a soft red glow.
```

### Лист B — потиры и питьё

Файл: `art/atlas/v2/b-chalices.png`. Строки — ступени `raw`, `bone`,
`obsidian`, `crimson`; столбцы — `potion-<ступень>` (полный),
`potion-<ступень>-drink-1`, `-drink-2`, `-drink-3` (пустой). Пятый ряд —
`fx-drink-1…4`.

```
Image 1024×1280. Grid 4 columns × 5 rows, cells 256×256.
Rows 1–4 — a blood chalice, one tier per row: Raw (plain iron cup, #9aa3b8), Bone (carved
bone goblet, #efe4ea), Obsidian (glossy violet-black glass with bright violet glints
#c38bff, thin stem), Crimson (ornate gold #f2c14e grail with crimson gems and a small
crown rim). Silhouettes differ by tier, not only colour.
Columns — drinking animation of the same chalice:
 1. full to the brim with bright blood, a white shine on the surface;
 2. the chalice tilts ~15° and the blood level drops to two thirds;
 3. tilted ~30°, blood almost gone, a last drop at the rim;
 4. upright and empty, the inside dark.
Row 5 — drink effect, 4 frames (cells 1–4): a small burst of crimson droplets flying up and
fading, frame 1 dense, frame 4 almost gone.
```

### Лист C — горгульи: покой и атака

Файл: `art/atlas/v2/c-gargoyles.png`. Строки — ступени; столбцы —
`gargoyle-<ступень>` (покой), `-attack-1`, `-attack-2`, `-attack-3`.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384 (tall cells).
Rows = tiers: Raw (pale grey stone #b6a4c8, small), Bone (bleached bone #efe4ea, taller,
spikes), Obsidian (glossy dark glass with bright violet edges #c38bff, sharper, taller),
Crimson (blood-red #d6334a with gold trim #f2c14e and glowing runes, tallest, crowned).
A gargoyle perched on a pedestal, facing the viewer. The pedestal is identical in all four
frames of a row and never moves.
Columns — attack animation:
 1. idle: wings folded, eyes glowing softly;
 2. wind-up: wings spread, head raised, mouth opening with a bright crimson glow inside;
 3. strike: head thrust forward/down, mouth wide, a bright flash at the mouth;
 4. recover: wings half-folded, glow fading.
```

### Лист D — лозы: покой и атака (третий прогон)

Что не так со вторым: пасть раскрывается и плюёт **вбок**, а лоза бьёт по
своему столбцу — вверх и вниз. Кадр покачивания не нужен: в покое постройки
стоят неподвижно.

Файл: `art/atlas/v3/d-vines.png`. Строки — ступени; столбцы — `vine-<ступень>`
(покой), `-attack-up-1`, `-attack-up-2`, `-attack-down-1`, `-attack-down-2`.
Игра берёт «вверх» или «вниз» по тому, где цель.

```
Image 1280×1536. Grid 5 columns × 4 rows, cells 256×384.
Rows = tiers (pale stone-bark, bone, violet obsidian, crimson-and-gold). A carnivorous
thorny vine rooted in a small mound, with a toothed bud-mouth on top, seen top-down 3/4.
The roots and the mound are pixel-identical in all five frames of a row.
Columns:
 1. idle: stem straight up, mouth closed, facing the viewer. Symmetric, no lean.
 2. attack UP, wind-up: the stem coils down a little, the bud tilts UP (towards the top
    of the image) and opens, bright crimson inside.
 3. attack UP, strike: the stem shoots straight up, the mouth faces straight UP and spits
    a jet of thorns vertically upward, off the top of the bud.
 4. attack DOWN, wind-up: the bud bends forward and down over the mound, facing the
    viewer / the bottom of the image, mouth opening.
 5. attack DOWN, strike: the mouth faces straight DOWN and spits a jet of thorns vertically
    downward, in front of the mound.
Never spit sideways: every attack jet is strictly vertical.
```

### Лист E — мортиры: целиком, не по частям (третий прогон)

Что не так со вторым: основание и ствол нарисованы отдельно и не стыкуются —
на поле видна склейка пушки и мортиры. Теперь мортира рисуется **целиком**, а
отдача — отдельным целым кадром.

Файл: `art/atlas/v3/e-mortars.png`. Строки — ступени; столбцы —
`mortar-<ступень>` (покой), `mortar-<ступень>-fire` (выстрел),
`mortar-<ступень>-flash` (вспышка у дула).

```
Image 768×1024. Grid 3 columns × 4 rows, cells 256×256.
Rows = tiers (pale iron #9aa3b8, bone #efe4ea, violet-glass obsidian, crimson-and-gold).
A squat siege MORTAR — one solid object, not a cannon on a stand: a short, wide,
bell-mouthed barrel (a funeral urn) sitting deep in a heavy low carriage of iron and bone
with a skull emblem. The barrel is part of the carriage, angled up at ~45° to the RIGHT.
Seen side-on in top-down 3/4, filling the cell width, standing on the bottom edge.
Columns:
 1. idle: the whole mortar at rest.
 2. firing: the SAME mortar, pixel-identical carriage; only the barrel is pushed a few
    pixels back and down into the carriage, a puff of grey-violet smoke at the mouth.
 3. MUZZLE FLASH ONLY: a crimson-orange blast with ash sparks, bursting up-right, centred
    in the cell — drawn alone, it is placed at the barrel mouth by the game.
Frames 1 and 2 must overlay exactly: same size, same carriage pixels, same ground line.
```

### Лист F — завеса тумана: столб и туман отдельно

Файл: `art/atlas/v2/f-fogveils.png`. Строки — ступени; столбцы —
`fogveil-<ступень>` (столб без тумана), `fog-<ступень>-1`, `-2`, `-3`.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384.
Rows = tiers (pale stone, bone, violet obsidian, crimson-and-gold).
Columns:
 1. the totem / lantern ALONE, no fog around it, a bright glowing core;
 2–4. FOG ONLY, SEPARATE: a loop of three frames of bright lilac fog (#c38bff / #e2c8ff,
    semi-transparent look through lighter centre) swirling low around where the totem's
    base would be; each frame shifted a little so the three loop smoothly.
```

### Лист G — враги: ходьба и гибель

Файл: `art/atlas/v2/g-enemies.png`. Строка 1 — `hunter-walk-1…4`, строка 2 —
`hunter-death-1…4`, строка 3 — `preacher-walk-1…4`, строка 4 —
`preacher-cast-1`, `-cast-2`, `preacher-death-1`, `-death-2`.

```
Image 1536×1792. Enemies walk UP the screen toward the castle — seen from above and behind
(top-down 3/4, back view). Bright holy colours so they stand out on dark ground:
white #fff6f8, gold #f2c14e, sky-blue trim #8fc7ff.
Row 1 — grid 6 columns × 1, cells 256×256 (cells 5–6 empty): Order of Dawn hunter, a small
crusader in a white-and-gold tabard with a burning torch. Walk cycle of 4 CLEARLY DIFFERENT
frames: left foot forward, passing, right foot forward, passing. The figure fills ~55% of
the cell.
Row 2 — same grid: the hunter's death, 4 frames: hit (knocked back, torch dropping),
falling, lying, dissolving into golden dust.
Row 3 — grid 4 columns × 1, cells 384×512: the Preacher, the boss — a tall priest in white
and gold robes with a glowing book and a radiant halo. Slow walk cycle, 4 clearly
different frames.
Row 4 — same grid: 2 frames of casting (book raised, halo flaring bright), then 2 frames
of death (kneeling, bursting into light).
Same character in every frame: identical proportions, colours and scale.
```

### Лист H — снаряды, попадания и эффекты

Файл: `art/atlas/v2/h-shots.png`. Строки: `shot-gargoyle-*` · `shot-vine-*` ·
`shot-mortar-*` (по ступеням) · `hit-gargoyle-1…3`, `hit-vine-1…3` ·
`hit-mortar-1…3`, `shot-shadow` · `fx-merge-1…5` · `fx-fire-1…6` ·
`fx-spawn-1…4`.

```
Image 1024×1024. Grid 8 columns × 8 rows, cells 128×128. Sprites centred in cells.
Bright, glowing, readable at small size.
Row 1: gargoyle projectile, 4 tiers — a glowing stone shard, POINTING DOWN.
Row 2: vine projectile, 4 tiers — a long bright thorn bolt, POINTING DOWN.
Row 3: mortar shell, 4 tiers — a round bone shell with a glowing crimson fuse, small.
Row 4: cells 1–3 — gargoyle hit (a burst of pale stone chips, 3 frames growing and
fading); cells 4–6 — vine hit (crimson thorn splinters, 3 frames).
Row 5: cells 1–3 — mortar hit (an explosion of ash and crimson fire, 3 frames); cell 4 — a
small soft dark oval shadow.
Row 6: merge / level-up effect, 5 frames: a ring of crimson-gold light expanding and
fading, with rising sparks.
Row 7: fire, 6 frames: a crimson-orange flame that flares up and burns out, drawn from the
ground upward (base on the bottom of the cell).
Row 8: spawn dust, 4 frames: a puff of grey-violet dust rising and fading.
```

### Лист I — туман под полем (вместо облаков)

Файл: `art/atlas/v2/i-fog.png`. Верхняя полоса — `cloud-back` (дальний туман),
нижняя — `cloud-front` (ближний). Имена кадров прежние: игра так же повторяет
полосы по ширине экрана, заливает всё ниже их нижним рядом и медленно
сдвигает в бою.

```
Image 1536×1024. Two horizontal strips of low graveyard fog, each tileable seamlessly
left-to-right (the rightmost column continues exactly into the leftmost one).

Mood: cold night mist creeping in from the moor below a vampire castle — not fluffy
clouds. Soft rolling wisps and curls with a few thin tendrils reaching up, dithered
pixel-art edges, no hard outline.

Strip 1 (top half): the far fog layer — darker, dusky violet (#4a3a78 → #7a6aa8),
translucent-looking wisps along the top, denser body below; the bottom 20 rows are ONE
flat colour (#5a4a88).
Strip 2 (bottom half): the near fog layer — lighter, pale lilac-grey (#b8b0d8 → #e6e0f4)
with faint crimson glints here and there (#ff3b55, very sparse, like distant candles
seen through the mist); the same rules: wispy top, dense body, bottom 20 rows ONE flat
colour (#cfc8e6).
Background above the fog tops: pure magenta #FF00FF. No stars, no sky, no ground.
```

Облака первого прогона (`art/atlas/5-clouds.png`) остаются в игре, пока нет
этого листа.

---

## Четвёртый прогон — у каждой постройки свой цвет

> Заменён пятым прогоном: цвет вида держится, но ступени неотличимы. Промты
> ниже — для истории.

Главная проблема второго и третьего прогонов: все постройки в одной гамме —
тёмный камень, багровое и фиолетовое. На поле горгулья, лоза, мортира и
завеса сливаются, вид читается только по силуэту. В оригинале у каждой башни
свой цвет. Теперь **цвет — это вид**, а **ступень — это материал и величина**.

| Постройка | Цвет вида (тело и свечение) | Коды | Чем НЕ быть |
|---|---|---|---|
| Горгулья | холодный лёд: серо-голубой камень, ледяное голубое свечение глаз и пасти | тело `#8fa6c8` `#c4d4ea`, свечение `#6fd6ff` | не красной и не фиолетовой |
| Хищная лоза | ядовитая зелень: изумрудный стебель, кислотно-жёлтая пасть | тело `#3f9a52` `#7ed36b`, свечение `#d6ff5a` | не красной |
| Пепельная мортира | медь и огонь: бронзовый ствол, оранжевый жар | тело `#b8743a` `#e0a060`, свечение `#ff9a3c` | не серой и не фиолетовой |
| Завеса тумана | сирень: фиолетовый столб, светло-лиловый туман | тело `#7a5ab8` `#b89be6`, свечение `#e2c8ff` | не красной |
| Потир (не постройка) | кровь: как сейчас — алое | `#ff3b55` | — |

**Ступени** отличаются **только величиной и украшениями**, не цветом:

- Грубая — мелкая, простая, без украшений;
- Костяная — чуть выше, немного шипов;
- Обсидиановая — ещё выше, острые грани, больше шипов;
- Багровая — самая большая, золотая корона и золотой кант (золото — только в
  отделке, тело остаётся цвета вида).

Цвет вида держится на всех четырёх ступенях: Багровая горгулья — голубая с
золотой короной, а не красная.

### Почему первая попытка не сработала (2026-09-29)

Цвет вида вставили отдельным блоком, а в промтах листов осталось описание
ступеней материалами — «pale stone, bone, violet obsidian, crimson-and-gold».
Генератор понял материалы как цвета и раскрасил **ступени**, а не виды:
у обоих листов сверху вниз серо-голубой, белый, фиолетовый, золото. Поэтому:

- промт листа пишется **целиком**, без вставок и ссылок на прежние;
- цвет вида **повторяется в каждой строке** листа;
- про ступени — **ни одного цветового слова**: только величина и украшения;
- в конце — прямая проверка: «все 16 спрайтов одного цвета».

Общий блок стиля второго прогона сюда **не годится**: в нём общая палитра тел
(сиреневый камень, кость) и правило «акцент различает ступени» — ровно то, что
перекрашивает ступени. Для четвёртого прогона — свой блок, ниже.

### Общий блок стиля (четвёртый прогон)

Вставляется в начало каждого запроса листов C–F, перед промтом листа.

```
Style reference: the attached castle and field images — match their pixel-art style,
but the sprites must be BRIGHTER than the environment so they read clearly on top of it.

Pixel art: top-down 3/4 view, chunky pixels (each sprite reads as ~32×32 pixel-art
upscaled with hard nearest-neighbour edges, no anti-aliasing, no blur).

Colour rule (most important): each sheet is ONE building kind in ONE body colour, given
in the sheet prompt. Every sprite on the sheet uses that body colour. Tiers never change
the body colour — they differ only in size, spikes and ornaments; gold is allowed only as
trim on the last tier.

Readability rules:
- The sprites will sit on a dark purple ground #462d4a and dark violet water #2f1060.
  They must POP against both: average brightness clearly above the background.
- Near-black (#1b173a and darker) ONLY for the 1-px outline and the deepest shadow.
- Every sprite has a light rim highlight on its top-left edges.
- Silhouettes must be readable when the sprite is 48 px tall.

Theme: "Crimson Citadel" — a vampire lord's castle defending against the Order of Dawn.
Gothic, not cute.

Animation rules:
- Frames of one animation: identical size, position, scale, colours and outline; only the
  moving part changes. The base of the object stays on exactly the same pixels.

Sheet rules:
- Solid pure magenta background #FF00FF everywhere except the sprites. No shadows or glow
  on the background, no texture, no frame, no grid lines, no labels, no text.
- One sprite per cell, centred horizontally, standing on the BOTTOM edge of its cell
  (effects: centred in the cell).
- Empty magenta space between sprites — they must never touch.
```

**Порядок:** новый чат (старый уже «привык» к прежней палитре) → приложить
`castle.webp` и `field.webp` → общий блок + лист C → проверить → лист D, E, F
в том же чате. Готовые листы — в `art/atlas/v4/` под именами из промтов, дальше
`python3 scripts/build-atlas.py`.

### Лист C — горгульи, лёд

Файл `art/atlas/v4/c-gargoyles.png`, кадры как во втором прогоне.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384 (tall cells).
ONE colour for the whole sheet: every gargoyle and every pedestal on all 16 sprites is
ICE-BLUE stone — body #8fa6c8, highlights #c4d4ea, glowing eyes and mouth ice-cyan #6fd6ff.
No purple, no red, no bone-white, no black glass anywhere on the gargoyles.
A stone gargoyle perched on a short pedestal, facing the viewer. The pedestal is identical
in all four frames of a row.
Rows = four tiers of the SAME ice-blue gargoyle; they differ ONLY in size and ornament:
 Row 1: small, plain, no ornaments — ice-blue.
 Row 2: a bit taller, a few spikes on the wings and pedestal — ice-blue.
 Row 3: taller, sharp faceted wings, more spikes — ice-blue.
 Row 4: tallest, a small gold crown #f2c14e and gold edging on the pedestal — body still ice-blue.
Columns — attack animation:
 1. idle: wings folded, eyes glowing ice-cyan;
 2. wind-up: wings spread, head raised, mouth opening with an ice-cyan glow;
 3. strike: head thrust forward, a bright ice-cyan flash at the mouth;
 4. recover: wings half-folded, glow fading.
Check before finishing: all 16 gargoyles are the same ice-blue colour.
```

### Лист D — лозы, ядовитая зелень

Файл `art/atlas/v4/d-vines.png`, кадры как в третьем прогоне.

```
Image 1280×1536. Grid 5 columns × 4 rows, cells 256×384.
ONE colour for the whole sheet: every vine on all 20 sprites is POISON GREEN — stem
#3f9a52, highlights #7ed36b, the inside of the mouth and the spit of thorns acid-yellow
#d6ff5a. The mound under it is dark earth #3c2a50. No blue, no purple, no red, no
bone-white on the vine.
A carnivorous thorny vine rooted in a small mound, with a toothed bud-mouth on top, seen
top-down 3/4. The mound is pixel-identical in all five frames of a row.
Rows = four tiers of the SAME green vine; they differ ONLY in size and ornament:
 Row 1: small, few thorns — green.
 Row 2: a bit taller, more thorns — green.
 Row 3: taller, long sharp thorns, a few glowing acid-yellow buds — green.
 Row 4: tallest, gold thorn tips #f2c14e and a small gold crown on the bud — stem still green.
Columns:
 1. idle: stem straight up, mouth closed, symmetric.
 2. attack UP, wind-up: the bud tilts up and opens, acid-yellow inside.
 3. attack UP, strike: the mouth faces straight up and spits a jet of acid-yellow thorns
    vertically upward.
 4. attack DOWN, wind-up: the bud bends forward and down, mouth opening.
 5. attack DOWN, strike: the mouth faces straight down and spits a jet of thorns vertically
    downward in front of the mound.
Never spit sideways. Check before finishing: all 20 vines are the same poison green.
```

### Лист E — мортиры, медь и огонь

Файл `art/atlas/v4/e-mortars.png`, кадры как в третьем прогоне.

```
Image 768×1024. Grid 3 columns × 4 rows, cells 256×256.
ONE colour for the whole sheet: every mortar on all 8 mortar sprites is BRONZE and COPPER —
body #b8743a, highlights #e0a060, glowing seams and embers orange #ff9a3c. No grey, no
purple, no bone-white, no black glass.
A squat siege mortar, one solid object: a short wide bell-mouthed barrel sitting deep in a
heavy low carriage on wheels with a skull emblem, barrel angled up ~45° to the RIGHT.
Rows = four tiers of the SAME bronze mortar; they differ ONLY in size and ornament:
 Row 1: small, plain — bronze.
 Row 2: a bit larger, riveted bands and spikes — bronze.
 Row 3: larger, heavy armour plates and glowing orange seams — bronze.
 Row 4: largest, gold trim #f2c14e and a gold skull crown — body still bronze.
Columns:
 1. idle: the whole mortar at rest.
 2. firing: the same mortar, identical carriage; the barrel pushed a few pixels back, a puff
    of smoke at the mouth.
 3. muzzle flash only: an orange-yellow blast with sparks bursting up-right, centred.
Frames 1 and 2 overlay exactly. Check before finishing: all 8 mortars are the same bronze.
```

### Лист F — завесы тумана, сирень

Файл `art/atlas/v4/f-fogveils.png`, кадры как во втором прогоне.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384.
ONE colour for the whole sheet: every totem on all 4 totem sprites is LILAC-VIOLET stone —
body #7a5ab8, highlights #b89be6, glowing core pale lilac #e2c8ff; the fog is pale lilac
#e2c8ff / #c8b4f0. No red, no gold body, no bone-white.
Rows = four tiers of the SAME lilac fog totem; they differ ONLY in size and ornament:
 Row 1: a short plain obelisk — lilac.
 Row 2: a bit taller, carved runes — lilac.
 Row 3: taller, sharp crystal spires — lilac.
 Row 4: tallest, gold trim #f2c14e and a crown — body still lilac.
Columns:
 1. the totem alone, no fog, a bright glowing core;
 2–4. FOG ONLY: three frames of pale lilac fog swirling low where the totem's base would be.
Check before finishing: all 4 totems are the same lilac colour.
```

Если генератор и так снова раскрасит ступени — есть запасной путь: скрипт
сборки может сам перекрасить готовые спрайты в цвет вида (градиентная карта по
яркости), оставив золото Багровой ступени. Работает на любых листах, но
перекраска всегда выглядит беднее родного рисунка.

## Пятый прогон — вид по телу, ступень по подножию (2026-09-29)

Четвёртый прогон перегнул в другую сторону: вид теперь держит цвет, зато
ступени перестали различаться — «только величина и украшения» генератор
рисует почти одинаковыми, а цвет больше ничего не несёт. Ещё пропала готика:
вместо резного постамента со светящимся витражом (второй прогон) — гладкий
голубой кирпич.

Цвет несёт **два знака сразу, на разных частях спрайта**:

- **тело** (горгулья, лоза, мортира, столб завесы) — **цвет вида**, один на всех
  четырёх ступенях, как в четвёртом прогоне;
- **подножие** (постамент, холмик, лафет, основание) — **ступень**, одна и та же
  у всех видов: Грубая — серый битый камень; Костяная — белая кость с черепами;
  Обсидиановая — чёрное стекло с фиолетовым кристаллом; Багровая — тёмный
  готический постамент с алым витражом и золотом, и корона на теле.

Так вид читается по цвету тела, ступень — по подножию, и Костяная горгулья
на одном поле с Костяной лозой — видно, что ступень одна. Подножие — отдельный
предмет из другого материала: генератору это прямо сказано, чтобы цвет
подножия не перетекал на тело. Тело растёт со ступенью заметно — от маленького
к вдвое крупнее.

**Плитки и снаряды — в цвет своей постройки.** Три плитки превращаются в
постройку, значит плитка того же цвета, что и тело постройки: серый камень →
ледяная горгулья, зелёный терновник → зелёная лоза, медный прах → бронзовая
мортира, сиреневый туман → сиреневая завеса, алая кровь → алый потир. Заодно
уходит путаница второго прогона, где терновник и кровь оба алые. Снаряд и его
попадание — тоже цвета стрелка.

Порядок: новый чат, `castle.webp` и `field.webp` как образец, общий блок пятого
прогона + лист C, проверить; дальше D, E, F, A, H в том же чате (у A и H общий
блок про подножия не нужен — там подножий нет, но стиль тот же). Файлы — в
`art/atlas/v4/`.

### Общий блок стиля (пятый прогон)

```
Style reference: the attached castle and field images — match their gothic pixel-art
style and detail, but the sprites must be BRIGHTER than the environment.

Pixel art: top-down 3/4 view, chunky pixels (~32×32 pixel-art upscaled with hard
nearest-neighbour edges, no anti-aliasing, no blur). Rich carved gothic detail, not flat.

Colour rule (most important). Every sprite has TWO separate parts of DIFFERENT materials:
- the BODY (the creature or the weapon) — ALWAYS the body colour given for the sheet,
  identical on all four rows;
- the BASE under it (pedestal, mound, carriage) — ALWAYS the tier material of its row,
  the same four bases for every building in the game:
  Row 1 RAW: a crude block of cracked grey fieldstone #6f6a78, no glow, no ornament.
  Row 2 BONE: a plinth of white bone #efe4ea with small skulls and ribs.
  Row 3 OBSIDIAN: a plinth of black volcanic glass #1b173a with sharp facets and one
        glowing violet crystal #c38bff.
  Row 4 CRIMSON: a tall gothic plinth of dark stone with a glowing crimson stained-glass
        window #ff3b55 and gold trim #f2c14e.
The base colour must never spread onto the body, and the body colour never onto the base.

Tier growth: row 1 body is small and plain; each row the body is clearly bigger, with
more horns, spikes and wing span; row 4 body is about twice the size of row 1 and wears a
small gold crown. Tiers must be told apart at a glance at 48 px.

Readability: sprites sit on dark purple ground #462d4a and violet water #2f1060 and must
pop against both. Near-black only for the 1-px outline and the deepest shadow. Light rim
highlight on the top-left edges.

Theme: "Crimson Citadel" — a vampire lord's castle defending against the Order of Dawn.
Gothic, not cute.

Animation rules: frames of one row — identical size, position, scale, colours, outline;
only the moving part changes; the base stays on exactly the same pixels.

Sheet rules: solid pure magenta #FF00FF background, no shadows or glow on it, no grid
lines, no labels, no text. One sprite per cell, centred, standing on the BOTTOM edge of
its cell (effects centred). Empty magenta space between sprites — they never touch.
```

### Лист C — горгульи (пятый прогон)

Файл `art/atlas/v4/c-gargoyles.png`.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384 (tall cells).
BODY: a stone gargoyle perched on its base, facing the viewer. Body colour on ALL 16
sprites: ICE-BLUE stone #8fa6c8 with highlights #c4d4ea, eyes and mouth glowing ice-cyan
#6fd6ff.
BASE by row, as in the colour rule: row 1 cracked grey fieldstone block; row 2 white bone
plinth with skulls; row 3 black obsidian plinth with a violet crystal; row 4 gothic plinth
with a crimson stained-glass window and gold trim.
Rows: row 1 small gargoyle, wings folded, stubby horns; row 2 bigger, longer horns, spiked
wings; row 3 bigger still, sharp faceted wings, spine ridge; row 4 the largest, huge wings,
gold crown — body still ice-blue.
Columns — attack:
 1. idle: wings folded, eyes glowing;
 2. wind-up: wings spread, head raised, mouth opening with an ice-cyan glow;
 3. strike: head thrust forward, a bright ice-cyan bolt at the mouth;
 4. recover: wings half-folded, glow fading.
Check: every gargoyle body is ice-blue; the four bases are grey stone, white bone, black
obsidian, crimson-and-gold — one per row.
```

### Лист D — лозы (пятый прогон)

Файл `art/atlas/v4/d-vines.png`.

```
Image 1280×1536. Grid 5 columns × 4 rows, cells 256×384.
BODY: a carnivorous thorny vine with a toothed bud-mouth on top, seen top-down 3/4. Body
colour on ALL 20 sprites: POISON GREEN stem #3f9a52 with highlights #7ed36b, the inside of
the mouth and the spit of thorns acid-yellow #d6ff5a.
BASE by row (the vine grows out of it): row 1 a heap of cracked grey fieldstone; row 2 a
mound of white bones and skulls; row 3 a cluster of black obsidian shards with a violet
crystal; row 4 a gothic stone planter with a crimson stained-glass window and gold trim.
The base is pixel-identical in all five frames of a row.
Rows: row 1 short, few thorns; row 2 taller, more thorns; row 3 taller still, long sharp
thorns, extra bud-heads; row 4 the tallest, a gold crown on the bud — stem still green.
Columns:
 1. idle: stem straight up, mouth closed, symmetric.
 2. attack UP, wind-up: the bud tilts up and opens.
 3. attack UP, strike: mouth straight up, a jet of acid-yellow thorns vertically upward.
 4. attack DOWN, wind-up: the bud bends forward and down, mouth opening.
 5. attack DOWN, strike: mouth straight down, a jet of thorns vertically downward in front
    of the base.
Never spit sideways. Check: every vine is poison green; the four bases differ by row.
```

### Лист E — мортиры (пятый прогон)

Файл `art/atlas/v4/e-mortars.png`.

```
Image 768×1024. Grid 3 columns × 4 rows, cells 256×256.
BODY: a short wide bell-mouthed siege-mortar barrel angled up ~45° to the RIGHT, sitting
deep in its carriage — one solid object. Barrel colour on ALL 8 mortar sprites: BRONZE and
COPPER #b8743a with highlights #e0a060, glowing seams and embers orange #ff9a3c.
BASE = the low heavy carriage on wheels, by row: row 1 crude grey fieldstone block on stone
wheels; row 2 white bone carriage with skull wheels; row 3 black obsidian carriage with a
violet crystal; row 4 gothic dark-stone carriage with a crimson stained-glass panel and gold
trim.
Rows: row 1 small plain barrel; row 2 bigger, riveted bands; row 3 bigger, armour plates and
glowing seams; row 4 the largest, gold skull crown on the barrel — barrel still bronze.
Columns:
 1. idle: the whole mortar at rest.
 2. firing: identical carriage; the barrel pushed a few pixels back, a puff of smoke at the
    mouth.
 3. muzzle flash only: an orange-yellow blast with sparks bursting up-right, centred.
Frames 1 and 2 overlay exactly. Check: every barrel is bronze; the four carriages differ by row.
```

### Лист F — завесы тумана (пятый прогон)

Файл `art/atlas/v4/f-fogveils.png`.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384.
BODY: a fog totem — a carved obelisk with a glowing core. Body colour on all 4 totems:
LILAC-VIOLET stone #7a5ab8 with highlights #b89be6, core glowing pale lilac #e2c8ff.
BASE by row: row 1 cracked grey fieldstone block; row 2 white bone plinth with skulls;
row 3 black obsidian plinth with a violet crystal; row 4 gothic plinth with a crimson
stained-glass window and gold trim.
Rows: row 1 a short plain obelisk; row 2 taller, carved runes; row 3 taller, crystal
spires; row 4 the tallest, a gold crown — body still lilac.
Columns:
 1. the totem on its base, no fog, bright core;
 2–4. FOG ONLY, no totem and no base: three frames of pale lilac fog #e2c8ff / #c8b4f0
    swirling low.
Check: every totem is lilac; the four bases differ by row.
```

### Лист A — плитки (пятый прогон)

Файл `art/atlas/v4/a-tiles.png`. Кадры: `tile-stone`, `tile-thorn`, `tile-ash`,
`tile-fog`, `tile-blood` — в этом порядке.

```
Image 1280×256. Grid 5 columns × 1 row, cells 256×256. Each tile is a compact object
filling ~85% of the cell, bright and readable at 40 px. No base, no pedestal.
Each tile has ONE colour — the colour of the building it turns into; five tiles, five
clearly different colours:
 1. Grave stone → gargoyle: a weathered tombstone of ICE-BLUE stone #8fa6c8 / #c4d4ea with
    a glowing ice-cyan #6fd6ff rune carved in it. NO gargoyle or any creature on it — it is
    raw material, it must not look like the gargoyle building.
 2. Thorn → vine: a knot of POISON-GREEN thorny bramble #3f9a52 / #7ed36b with acid-yellow
    #d6ff5a thorn tips.
 3. Ash → mortar: a BRONZE-COPPER funeral urn #b8743a / #e0a060 spilling glowing orange
    #ff9a3c embers.
 4. Fog → fog veil: a swirling wisp of LILAC mist #7a5ab8 / #e2c8ff with two glowing
    white eyes.
 5. Blood → chalice: a single glossy CRIMSON drop #ff3b55 with a white shine and a soft red
    glow, floating on its own. NOT a cup, NOT a chalice, NOT a goblet — the chalice is a
    different item made from three drops.
No tile shares its main colour with another: blue, green, bronze, lilac, crimson.
```

### Лист H — снаряды и попадания (пятый прогон)

Файл `art/atlas/v4/h-projectiles.png`. Строки: `shot-gargoyle-*`,
`shot-vine-*`, `shot-mortar-*` (по ступеням), `hit-gargoyle-1…3`,
`hit-vine-1…3`, `hit-mortar-1…3`. Вспышка слияния, пламя, пыль выхода и тень —
со второго прогона (лист H), их не переделываем.

```
Image 512×768. Grid 4 columns × 6 rows, cells 128×128. Sprites centred in cells, bright,
glowing, readable at small size. Each row is exactly the number of sprites listed.
Row 1 (4 sprites): gargoyle projectile, tiers 1–4 — a glowing ICE-CYAN crystal shard
  #6fd6ff / #c4d4ea POINTING DOWN; each tier bigger and brighter, tier 4 with gold sparks.
Row 2 (4 sprites): vine projectile, tiers 1–4 — a long POISON-GREEN thorn bolt #3f9a52 with
  an acid-yellow #d6ff5a glowing tip, POINTING DOWN; each tier longer, tier 4 gold-tipped.
Row 3 (4 sprites): mortar shell, tiers 1–4 — a round BRONZE cannonball #b8743a with a
  glowing orange #ff9a3c fuse, small; each tier bigger, tier 4 with gold bands.
Row 4 (3 sprites): gargoyle hit — a burst of ice-cyan crystal shards, growing and fading.
Row 5 (3 sprites): vine hit — a splash of green thorn splinters and acid-yellow drops.
Row 6 (3 sprites): mortar hit — an explosion of orange fire and bronze sparks.
Cells not listed stay empty magenta.
```

## Шестой прогон — один размер, ступень обрастает, завеса-препятствие (2026-09-30)

Пятый прогон оставляем по цвету: тело — вид, подножие — ступень. Меняем три
вещи:

1. **Один размер на всех ступенях.** Горгулья и лоза в пятом росли со ступенью —
   на поле Грубая выходила в полклетки, Багровая торчала в ряд выше. Теперь
   каждый спрайт листа занимает **одну и ту же рамку**: одинаковая высота,
   одинаковая ширина подножия (во всю клетку). Скрипт сборки размеры не
   подгоняет — ступени должны прийти одинаковыми с листа.
2. **Ступень обрастает.** Кроме подножия, со ступенью на **теле** появляются
   характерные детали — и **копятся**: каждая следующая ступень — всё, что
   было у прежней, плюс новое:
   - Грубая — голое тело, без украшений;
   - Костяная — + костяные рога, рёбра и шипы из кости на теле;
   - Обсидиановая — + чёрные обсидиановые кристаллы, прорастающие из тела,
     с фиолетовым свечением;
   - Багровая — + золотая корона, золотые накладки и алые самоцветы.
3. **Завеса тумана — препятствие на всю клетку.** Вместо высокого обелиска —
   низкая широкая преграда во всю клетку: кольцо стоячих камней (ограда),
   внутри плотно клубится сиреневый туман. Читается как «здесь не пройти
   быстро», а не как ещё одна башня. Ограда — материал ступени, как подножие.

Общий блок стиля — пятого прогона, плюс в конец него:

```
Size rule: every sprite on a sheet fills the SAME bounding box — the same height and the
same base width (the base spans the full cell width). Tiers never change the size.
Tier ornaments ACCUMULATE on the body: row 2 = row 1 + bone horns, ribs and bone spikes;
row 3 = row 2 + black obsidian crystals growing out of the body with a violet glow;
row 4 = row 3 + a gold crown, gold armour trim and crimson gems. The body colour stays.
```

Порядок — как в пятом: новый чат, `castle.webp` и `field.webp`, общий блок
пятого + «Size rule» выше, затем листы C, D, E, F. Файлы — в `art/atlas/v4/`,
завеса — под новым именем `f-fogwalls.png` (другая сетка).

### Лист C — горгульи (шестой прогон)

Файл `art/atlas/v4/c-gargoyles.png`.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384 (tall cells).
BODY: a stone gargoyle perched on its base, facing the viewer. Body colour on ALL 16
sprites: ICE-BLUE stone #8fa6c8 with highlights #c4d4ea, eyes and mouth glowing ice-cyan
#6fd6ff.
BASE by row: row 1 cracked grey fieldstone block; row 2 white bone plinth with skulls;
row 3 black obsidian plinth with a violet crystal; row 4 gothic plinth with a crimson
stained-glass window and gold trim. Every base is the same width and height.
SAME SIZE: the gargoyle is the same size and pose on all four rows.
ORNAMENTS ACCUMULATE on the gargoyle:
 row 1: bare ice-blue gargoyle, smooth horns, plain wings;
 row 2: + curved bone horns, bone spikes along the wings, a bone rib collar;
 row 3: + black obsidian crystals growing from the shoulders and spine, glowing violet;
 row 4: + a gold crown, gold claws and wing trim, crimson gems on the chest.
Columns — attack:
 1. idle: wings folded, eyes glowing;
 2. wind-up: wings spread, head raised, mouth opening with an ice-cyan glow;
 3. strike: head thrust forward, a bright ice-cyan bolt at the mouth;
 4. recover: wings half-folded, glow fading.
Keep spread wings inside the cell — frames never touch.
Check: all 16 gargoyles are ice-blue and the same size; ornaments add up row by row.
```

### Лист D — лозы (шестой прогон)

Файл `art/atlas/v4/d-vines.png`.

```
Image 1280×1536. Grid 5 columns × 4 rows, cells 256×384.
BODY: a carnivorous thorny vine with a toothed bud-mouth on top, seen top-down 3/4. Body
colour on ALL 20 sprites: POISON GREEN stem #3f9a52 with highlights #7ed36b, the inside of
the mouth and the spit of thorns acid-yellow #d6ff5a.
BASE by row (the vine grows out of it): row 1 a heap of cracked grey fieldstone; row 2 a
mound of white bones and skulls; row 3 black obsidian shards with a violet crystal; row 4 a
gothic stone planter with a crimson stained-glass window and gold trim. Every base is the
same width and height and is pixel-identical in all five frames of a row.
SAME SIZE: the vine is the same height and thickness on all four rows.
ORNAMENTS ACCUMULATE on the vine:
 row 1: bare green stem, a few plain thorns;
 row 2: + white bone thorns and a ring of small skulls tangled in the stem;
 row 3: + black obsidian crystal thorns glowing violet;
 row 4: + a gold crown on the bud, gold thorn tips, crimson gem buds.
Columns:
 1. idle: stem straight up, mouth closed, symmetric.
 2. attack UP, wind-up: the bud tilts up and opens.
 3. attack UP, strike: mouth straight up, a jet of acid-yellow thorns vertically upward.
 4. attack DOWN, wind-up: the bud bends forward and down, mouth opening.
 5. attack DOWN, strike: mouth straight down, a jet of thorns vertically downward in front
    of the base.
Never spit sideways. Check: all 20 vines green and the same size; ornaments add up by row.
```

### Лист E — мортиры (шестой прогон)

Файл `art/atlas/v4/e-mortars.png`.

```
Image 768×1024. Grid 3 columns × 4 rows, cells 256×256.
BODY: a short wide bell-mouthed siege-mortar barrel angled up ~45° to the RIGHT, sitting
deep in its carriage — one solid object. Barrel colour on ALL 8 mortar sprites: BRONZE and
COPPER #b8743a with highlights #e0a060, glowing seams and embers orange #ff9a3c.
BASE = the low heavy carriage on wheels, by row: row 1 crude grey fieldstone on stone
wheels; row 2 white bone carriage with skull wheels; row 3 black obsidian carriage with a
violet crystal; row 4 gothic dark-stone carriage with a crimson stained-glass panel and gold
trim. Every carriage is the same width and height.
SAME SIZE: the barrel is the same size on all four rows.
ORNAMENTS ACCUMULATE on the barrel:
 row 1: plain bronze barrel;
 row 2: + bone bands and small bone spikes around the barrel;
 row 3: + black obsidian crystal spikes glowing violet on the barrel;
 row 4: + a gold skull crown, gold bands, crimson gems.
Columns:
 1. idle: the whole mortar at rest.
 2. firing: identical carriage; the barrel pushed a few pixels back, a puff of smoke at the
    mouth.
 3. MUZZLE FLASH ONLY — no mortar in this cell: an orange-yellow blast with sparks bursting
    up-right, centred.
Frames 1 and 2 overlay exactly. Check: all barrels bronze and the same size.
```

### Лист F — завесы тумана, препятствие (шестой прогон)

Файл `art/atlas/v4/f-fogwalls.png` — новое имя, другая сетка.

```
Image 1024×1024. Grid 2 columns × 2 rows, cells 512×512. Reading order: top-left = tier 1,
top-right = tier 2, bottom-left = tier 3, bottom-right = tier 4.
A FOG BARRIER that blocks a whole square cell, seen top-down 3/4: a low, wide ring of
standing stones (a fence) enclosing a dense churning cloud of LILAC fog #7a5ab8 / #b89be6 /
#e2c8ff that fills the ring and rises a little above it. It is as wide as the cell, wider
than it is tall, and reads as an obstacle, not as a tower. Two faint glowing eyes in the fog.
FENCE material by tier (like the bases of the other buildings):
 tier 1: cracked grey fieldstones;
 tier 2: white bone posts and skulls;
 tier 3: black obsidian shards with violet crystals;
 tier 4: gothic dark stones with crimson stained-glass lanterns and gold trim.
SAME SIZE on all four tiers. The fog colour is the same on all four.
ORNAMENTS ACCUMULATE: tier 2 + bone spikes; tier 3 + obsidian crystals; tier 4 + a gold
crest and crimson gems on the fence.
Each sprite fills about 90% of its cell width, centred, bottom on the lower quarter.
Check: four fog barriers, all lilac fog, all the same size, fences differ by tier.
```

### Лист A — плитки (шестой прогон)

Файл `art/atlas/v4/a-tiles.png`. Кадры: `tile-stone`, `tile-thorn`, `tile-ash`,
`tile-fog`, `tile-blood` — в этом порядке. Лист пятого прогона хорош, кроме двух
плиток: на надгробии сидит горгулья (на поле его путают с Грубой горгульей), а
кровь нарисована кубком (путается с потиром). Терновник, урну и туман просим
оставить как были.

```
Image 1280×256. Grid 5 columns × 1 row, cells 256×256. Each tile is a compact object
filling ~85% of the cell, bright and readable at 40 px. No base, no pedestal.
Keep tiles 2, 3 and 4 exactly as in the previous tile sheet. Redraw tiles 1 and 5:
 1. Grave stone → gargoyle: a plain weathered GRAVESTONE — a rounded-top headstone slab
    of ICE-BLUE stone #8fa6c8 / #c4d4ea, cracked, with moss at its foot and a glowing
    ice-cyan #6fd6ff rune carved in the middle. ONLY the stone slab: NO gargoyle, NO
    statue, NO wings, NO horns, NO creature of any kind on or around it. It must look like
    a tombstone from a graveyard, clearly not like a gargoyle.
 2. Thorn → vine: a knot of POISON-GREEN thorny bramble #3f9a52 / #7ed36b with acid-yellow
    #d6ff5a thorn tips.
 3. Ash → mortar: a BRONZE-COPPER funeral urn #b8743a / #e0a060 spilling glowing orange
    #ff9a3c embers.
 4. Fog → fog veil: a swirling wisp of LILAC mist #7a5ab8 / #e2c8ff with two glowing
    white eyes.
 5. Blood → chalice: a single glossy CRIMSON drop #ff3b55 with a white shine and a soft
    red glow, floating on its own. NOT a cup, NOT a chalice, NOT a goblet.
Five tiles, five clearly different colours: blue, green, bronze, lilac, crimson.
```

Если вернутся только надгробие и капля, а терновник, урна и туман сменятся, —
годится и так: скрипт берёт все пять плиток с листа. Пока капли на листе нет,
кровь берётся со второго прогона.

### Лист H — снаряды и попадания (шестой прогон)

Файл `art/atlas/v4/h-projectiles.png`, сетка и строки — как в пятом прогоне.
В пятом снаряды росли со ступенью (Грубый осколок горгульи — вдвое меньше
Багрового). Теперь — как у построек: **один размер**, а ступень видна по
украшениям, которые копятся. Шип лозы на поле — в полклетки, как осколок
горгульи (раньше — в клетку, закрывал цель).

```
Image 512×768. Grid 4 columns × 6 rows, cells 128×128. Sprites centred in cells, bright,
glowing, readable at small size. Each row is exactly the number of sprites listed.
SIZE RULE: within a row every sprite has the SAME size and shape outline; tiers never
change the size. Tier ornaments ACCUMULATE: tier 2 + small white bone shards; tier 3 +
black obsidian crystal glints with a violet glow; tier 4 + gold sparks and a crimson gem.
Row 1 (4 sprites): gargoyle projectile — a glowing ICE-CYAN crystal shard #6fd6ff /
  #c4d4ea POINTING DOWN, the same size on all four tiers.
Row 2 (4 sprites): vine projectile — a SHORT poison-green thorn dart #3f9a52 with an
  acid-yellow #d6ff5a glowing tip, POINTING DOWN, the same size on all four tiers, no
  longer than the gargoyle shard.
Row 3 (4 sprites): mortar shell — a round BRONZE cannonball #b8743a with a glowing orange
  #ff9a3c fuse, the same size on all four tiers.
Row 4 (3 sprites): gargoyle hit — a burst of ice-cyan crystal shards, growing and fading.
Row 5 (3 sprites): vine hit — a splash of green thorn splinters and acid-yellow drops.
Row 6 (3 sprites): mortar hit — an explosion of orange fire and bronze sparks.
Keep every sprite well inside its cell; nothing crosses into the next row.
```

## Каталог — иконка и обложка (2026-09-30)

Для карточки игры на Яндексе: иконка 512×512 и обложка 800×470. Образец стиля —
как всегда, `castle.webp` и `field.webp`, плюс готовые листы шестого прогона
(`art/atlas/v4/c-gargoyles.png` и остальные), чтобы горгулья, лоза и мортира
были те же, что в игре. Арт Tower Swap не прикладывать.

Нужны ровно **PNG 512×512** (иконка) и **PNG 800×470** (обложка). Генератор
рисует точно в заказанном размере не всегда — просим крупнее и с теми же
пропорциями, потом `python3 scripts/catalog-art.py icon|cover <картинка>`
обрезает по центру и ужимает в `art/catalog/icon.png` и `cover.png`. **Текста на картинках нет**: буквы
генератор искажает, а название Яндекс и так пишет рядом с иконкой. Если на
обложке нужно название — наложим его сами, отдельным слоем.

### Иконка

Просим 1024×1024, в карточку ужимаем до 512×512. Должна читаться в 64 px —
в каталоге её видят мелкой.

```
Style reference: the attached castle, field and building sheets — the same gothic
pixel art, the same ice-blue gargoyle.
Square game icon, 1024×1024, pixel art with chunky hard-edged pixels, no text, no
letters, no logo, no frame, no rounded-corner mask (the platform adds its own).
Subject, big and centred, filling most of the square: the ICE-BLUE stone gargoyle
(#8fa6c8, eyes glowing ice-cyan #6fd6ff) with spread wings and a small gold crown,
perched on a gothic dark plinth with a glowing crimson stained-glass window (#ff3b55)
and gold trim. It roars, and a bright ice-cyan bolt bursts from its mouth toward the
viewer's lower right.
Background: a huge blood-red moon behind the gargoyle, the dark silhouette of a
vampire citadel with crimson windows, deep violet night sky #2f1060 fading to
#462d4a, a few wisps of lilac fog at the bottom.
One clear silhouette, strong contrast: the gargoyle is the brightest thing, the
background is dark and simple. It must read at 64×64 pixels.
```

### Обложка

Просим 1600×940 (те же пропорции, что 800×470), ужимаем вдвое. Обложка —
витрина: сразу видно, что это три в ряд и оборона замка.

```
Style reference: the attached castle, field and building sheets — the same gothic
pixel art, the same buildings.
Wide game cover art, 1600×940, pixel art with chunky hard-edged pixels, no text, no
letters, no logo, no UI.
Scene, seen from above at a 3/4 angle like the game:
- top: the vampire citadel — dark stone towers with glowing crimson windows and a
  gate, a huge blood-red moon behind it in a deep violet sky #2f1060;
- middle: in front of the gate, a square stone board of glowing tiles and buildings
  in a grid — ice-blue gargoyles, poison-green thorny vines, bronze mortars and lilac
  fog barriers, some on bone and obsidian bases, one crimson-and-gold with a crown;
  an ice-cyan bolt, a green thorn dart and a bronze cannonball fly down from them;
- bottom: white-and-gold crusader hunters of the Order of Dawn with torches march up
  out of rolling lilac fog toward the board; behind them, larger, the Preacher — a
  tall white-and-gold figure with a glowing halo and a holy book.
Composition: leave the left third a little calmer (darker sky, fewer details) so a
title can be placed there later. Strong contrast, rich colour, readable when the
cover is shown at 400×235.
```

Проверка перед загрузкой: иконку открыть в 64×64, обложку — в 400×235.
Горгулья на иконке узнаётся с первого взгляда, на обложке видно и поле, и
замок, и врагов.

## Первый прогон — архив (2026-09-28)

Промты, по которым нарисован нынешний атлас. Тёмные и без кадров анимации —
см. «Второй прогон».

### Общий блок стиля (первый прогон)

```
Style reference: the attached castle and field images. Match them exactly: dark gothic
pixel art, top-down 3/4 view, chunky pixels (each sprite reads as ~32×32 pixel-art
upscaled with hard nearest-neighbour edges, no anti-aliasing, no blur), dark 1-px outline,
soft light from the top-left.

Palette (stay inside it): night stone #03020d #100926 #1b173a #3c2a50 #66517b,
field earth #412447 #462d4a #5e4b6f, water violet #2c105a #35135d,
crimson #680423 #9b1b30 #d6334a, glowing blood-red #ff0926 (only for glow and magic),
bone #efe4ea, ash #b3a0ba.

Theme: "Crimson Citadel" — a vampire lord's castle defending against the Order of Dawn.
Everything should look like it belongs to this castle: carved dark stone, wrought iron,
bone, crimson glass, candle glow. No cute or cartoon style, no bright daylight colours.

Sheet rules:
- Solid pure magenta background #FF00FF everywhere except the sprites (or a truly
  transparent background). No shadows or glow on the background, no texture, no frame.
- Sprites are placed on an exact invisible grid described below, one sprite per cell,
  centred horizontally, standing on the BOTTOM edge of its cell.
- Do not draw grid lines, labels, numbers or text.
- All sprites of one sheet share the same scale and pixel size.
```

Палитра снята с `castle.webp` и `field.webp` (самые частые цвета) и с
переменных интерфейса в `src/app/global.scss`.

---

### Первый прогон — лист 1 — плитки и потиры

Файл: `art/atlas/1-tiles.png`. Кадры по порядку: `tile-stone`, `tile-thorn`,
`tile-ash`, `tile-fog` · `tile-blood`, `potion-raw`, `potion-bone`,
`potion-obsidian` · `potion-crimson`.

```
Image 1024×768. Grid 4 columns × 3 rows, cells 256×256.

Row 1 — match-3 tiles, each a compact object filling ~80% of the cell:
 1. Grave stone: weathered cracked tombstone, dark stone.
 2. Blood thorn: a knot of crimson thorny bramble.
 3. Ancestral ash: a small bone-white funeral urn spilling grey ash.
 4. Grave fog: a swirling wisp of pale violet mist with two faint eye-like glints.
Row 2:
 1. Blood: a glossy drop of blood with a crimson glow.
 2–4. Blood chalice, tiers 1–3 (see below).
Row 3:
 1. Blood chalice, tier 4. Other cells empty.

Blood chalice — a goblet filled with blood; each tier must be recognisable by
silhouette, not only by colour:
 tier 1 Raw — plain rough iron cup;
 tier 2 Bone — carved bone goblet, taller;
 tier 3 Obsidian — black glass chalice with violet glints and a thin stem;
 tier 4 Crimson — ornate crimson-and-gold grail, glowing, with a small crown rim.
```

### Первый прогон — лист 2 — постройки (4 постройки × 4 ступени)

Файл: `art/atlas/2-buildings.png`. Строки: `gargoyle-*`, `vine-*`, `mortar-*`,
`fogveil-*`; столбцы — `raw`, `bone`, `obsidian`, `crimson`.

```
Image 1024×1536. Grid 4 columns × 4 rows, cells 256×384 (tall cells).
Columns = tiers left to right: Raw, Bone, Obsidian, Crimson.
Each building stands on the bottom of its cell; its footprint is one square tile
256 wide; tall buildings may rise up to the top of the cell.
Tiers must differ in silhouette (height, material, crown), not only colour:
 Raw — rough grey stone and rusty iron, small;
 Bone — bleached bone and ivory, taller, spikes;
 Obsidian — black volcanic glass with violet shine, sharper and taller;
 Crimson — blood-red stone with gold trim and glowing runes, tallest, with a crown/spire.

Row 1 — Gargoyle: a stone gargoyle perched on a pedestal, wings half-open; it shoots
in all directions, so it looks watchful, facing the viewer. Tall — fills most of the cell.
Row 2 — Predatory vine: a carnivorous thorny vine with a toothed bud-mouth, rooted in the
ground, ~1 tile tall.
Row 3 — Ash mortar: a squat mortar made of iron and bone with a funeral urn as the
barrel, barrel pointing to the RIGHT (the game mirrors it), ~1 tile tall.
Row 4 — Fog veil: a short totem / lantern of dark stone exhaling pale violet fog around
its base; it does not shoot, it slows enemies. Slightly taller than 1 tile.
```

Мортира — **стволом вправо**: игра отражает её сама, когда она повёрнута влево.

### Первый прогон — лист 3 — враги (кадры анимации)

Файл: `art/atlas/3-enemies.png`. Строка 1 — `hunter-1…3` (анимация
1‑2‑3‑2), строка 2 — `preacher-1…4`.

```
Image 1536×1024. Two rows.
Enemies walk UP the screen toward the castle — we see them from above and behind
(top-down 3/4, back view, heading up).

Row 1 — grid 6 columns × 1, cells 256×256: Order of Dawn hunter, a small holy-crusader
soldier in a white-and-gold tabard with a torch or crossbow. Frames 1–3 are a walk cycle
(left foot, neutral, right foot); cells 4–6 empty. Small: the figure fills ~55% of the cell,
there will be dozens on screen.

Row 2 — grid 4 columns × 1, cells 384×512: the Preacher, the boss — a tall zealous priest
in white-gold robes with a glowing holy book and a halo of dawn light. Frames 1–4 are a
slow walk cycle. Clearly bigger and more imposing than the hunter.

Same character in every frame: identical proportions, colours and scale; only the
limbs move.
```

### Первый прогон — лист 4 — снаряды и эффекты

Файл: `art/atlas/4-shots.png`. Строки: `shot-gargoyle-*`, `shot-vine-*`,
`shot-mortar-*` (по ступеням) · `shot-explosion`, `shot-shadow`, `fx-death` ·
`fx-fire-1…6`.

```
Image 1024×1024. Grid 8 columns × 8 rows, cells 128×128. Sprites centred in cells.

Row 1: gargoyle projectile, tiers Raw, Bone, Obsidian, Crimson — a stone shard / spike
drawn POINTING DOWN (cells 1–4).
Row 2: vine projectile, 4 tiers — a long thorn bolt, POINTING DOWN, narrow and tall.
Row 3: mortar shell, 4 tiers — a round ash-filled bone shell, small (≈20% of the cell).
Row 4: cell 1 — explosion: a burst of grey ash and crimson sparks; cell 2 — a small soft
dark oval shadow on the ground; cell 3 — death puff: a small cloud of violet-grey dust.
Row 5: fire, 6 animation frames (cells 1–6): crimson-orange flame that flares up and burns
out, drawn from the ground upward, tall and narrow (flame base on the bottom of the cell).
```

### Первый прогон — лист 5 — облака под полем

Файл: `art/atlas/5-clouds.png`. Верхняя полоса — `cloud-back`, нижняя —
`cloud-front`.

```
Image 1536×1024. Two horizontal cloud strips, each tileable seamlessly left-to-right
(the right edge continues exactly into the left edge).

Strip 1 (top half): the back cloud layer — darker, cool grey-violet (#6f7090 → #b9c3d6),
fluffy pixel-art cloud tops on the upper part, solid flat body below; the bottom 20 rows
are ONE flat colour.
Strip 2 (bottom half): the front cloud layer — near white (#f8f9fb) with soft lavender
shading, the same rules: bumpy top, flat body, bottom 20 rows one flat colour.
Background above the cloud tops: pure magenta #FF00FF.
```

---

## История

| Дата | Лист | Что вышло |
|---|---|---|
| 2026-09-28 | 1–5 | Первый прогон всех пяти листов. Сетка не соблюдена по размерам, но порядок и зазоры верные — нарезка по пустым полосам справилась. Облака не бесшовные и с пурпурной каймой по низу — правится скриптом |
| 2026-09-29 | A | Плитки второго прогона пришли и встали в атлас (`art/atlas/v2/a-tiles.png`): светлые, на поле читаются |
| 2026-09-29 | I | Облака под полем заменяем туманом — промт листа I переписан |
| 2026-09-30 | каталог | Промты иконки 512×512 и обложки 800×470: без текста, горгулья шестого прогона, поле, замок и Орден |
| 2026-09-30 | H | Лист снарядов шестого прогона в атласе; попадания на нём разложены на всю ширину — скрипт режет ряд по промежуткам, по сетке — только если не сошлось |
| 2026-09-30 | H | Шестой прогон, снаряды: один размер по ступеням, украшения копятся; шип лозы в игре — полклетки вместо клетки |
| 2026-09-30 | A | Капля крови — снова со второго прогона: новая выглядела странно |
| 2026-09-30 | A, C–F | Шестой прогон принят: все пять листов в `art/atlas/v4/` и в атласе (завеса — `f-fogwalls.png`). Размер ступеней ровный у горгулий, мортир и завес; Багровая лоза с листа выше остальных |
| 2026-09-30 | A | Шестой прогон, плитки: надгробие — только камень, без горгульи и любых существ; кровь — одна капля, не кубок |
| 2026-09-30 | C–F | Шестой прогон: один размер на всех ступенях, украшения копятся по ступеням на теле, завеса — низкое препятствие во всю клетку (`f-fogwalls.png`, сетка 2×2). |
| 2026-09-29 | A, H | Листы A и H пятого прогона в атласе. Кровь вышла кубком (путается с потиром) — капля пока со второго прогона; на надгробии горгулья (путается с постройкой). Промт A: капля «NOT a cup», надгробие «NO gargoyle». Скрипт: лист H режется по сетке рядов |
| 2026-09-29 | C–F | Пятый прогон принят: листы C, D, E, F в `art/atlas/v4/`, в атласе. Скрипт: ряд со слипшимися кадрами режется по сетке (крылья горгулий); вспышка мортиры вырезается из кадра «мортира с огнём»; туман завесы — позади подножия, не поверх |
| 2026-09-29 | A, H | Пятый прогон: плитки и снаряды в цвет своей постройки (новый лист `h-projectiles.png`, слияние, пламя и пыль — со второго) |
| 2026-09-29 | C–F | Пятый прогон: лист C четвёртого вышел одноцветным, но ступени неотличимы и без готики. Теперь тело — цвет вида, подножие — ступень (серый камень, кость, обсидиан, алый витраж с золотом), общее для всех построек; тело растёт вдвое |
| 2026-09-29 | C–F | Свой общий блок стиля для четвёртого прогона: без общей палитры тел и без «акцент различает ступени»; ступени — только величина и украшения |
| 2026-09-29 | C, D | Первая попытка четвёртого прогона не удалась: генератор раскрасил ступени (серо-голубой, белый, фиолетовый, золото), а не виды. Промты C–F переписаны целиком: цвет вида в каждой строке, ступени — без цветовых слов |
| 2026-09-29 | C–F | Четвёртый прогон: у каждого вида постройки свой цвет тела на всех ступенях (горгулья — лёд, лоза — ядовитая зелень, мортира — медь, завеса — сирень); ступень — материал отделки и величина |
| 2026-09-29 | D, E | Листы третьего прогона пришли и встали (`art/atlas/v3/`): мортира цельная, лоза бьёт вверх и вниз. Струя вверх упирается в лозу ряда выше — скрипт режет ряды по линии земли; струя вниз ниже холмика обрезается, чтобы лоза не подпрыгивала |
| 2026-09-29 | D, E | Третий прогон: лоза бьёт строго вверх и вниз (было вбок); мортира целиком, без склейки основания и ствола; покачивание лозы и клубы завесы не нужны — постройки в покое неподвижны |
| 2026-09-29 | B–I | Пришли все листы второго прогона; собраны в атлас (144 кадра, 844 КБ). Мортиру и завесу скрипт собирает из частей; факел лежащего солдата — отдельный спрайт, склеивается с телом |
| 2026-09-29 | — | Разбор первого прогона: предметы слишком тёмные и сливаются с полем, анимировать нечего. Написан второй прогон (листы A–H): светлые тела, светлая кромка, акцент; движущиеся части отдельно, кадры покоя, атаки, питья, гибели и попаданий |
