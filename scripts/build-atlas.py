"""
Собирает атлас дизайнера из сгенерированных листов (docs/art-prompts.md).

Листы лежат в `art/atlas/` на пурпурном фоне #FF00FF. Скрипт:
  1. вырезает фон (и пурпурную кайму по краям спрайтов);
  2. находит спрайты по пустым полосам между ними — сетку генератор держит
     неточно, но порядок и зазоры соблюдает;
  3. масштабирует каждую группу к своему размеру в клетках (размеры — как у
     оригинала при клетке 48, docs/atlas.md) и ставит кадр по правилам сцены;
  4. облака делает бесшовными и выравнивает им низ в один цвет;
  5. упаковывает всё в `src/shared/assets/atlas/texture.webp` (палитра в 256
     цветов, WebP без потерь) + `atlas.json`.

Запуск: python3 scripts/build-atlas.py (нужен Pillow).
"""

import json
from pathlib import Path

from PIL import Image

SOURCE = Path('art/atlas')
TARGET = Path('src/shared/assets/atlas')

# Клетка атласа: крупнее оригинальной 48 — чётко на плотных экранах телефонов.
CELL = 128
# Ширина листа атласа; высота подбирается по упаковке.
SHEET_WIDTH = 2048

TIERS = ['raw', 'bone', 'obsidian', 'crimson']
# Высота горгульи в покое, в клетках.
GARGOYLE_HEIGHT = 1.15


# ── фон ─────────────────────────────────────────────────────────────────────


def is_key(r, g, b):
    """Пурпурный фон; с запасом — генератор его чуть шумит."""
    return r > 170 and b > 170 and g < 110


def is_fringe(r, g, b):
    """Кайма: смесь спрайта с фоном — пурпурнее любого цвета нашей палитры."""
    return r > 150 and b > 150 and g < min(r, b) * 0.45


def key_out(image):
    """Фон — в прозрачность, кайму по краю спрайта — тоже."""
    image = image.convert('RGBA')
    px = image.load()
    w, h = image.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if is_key(r, g, b):
                px[x, y] = (0, 0, 0, 0)
    for _ in range(2):
        edge = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0 or not is_fringe(r, g, b):
                    continue
                if any(
                    0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                ):
                    edge.append((x, y))
        for x, y in edge:
            px[x, y] = (0, 0, 0, 0)
    return image


# ── поиск спрайтов ──────────────────────────────────────────────────────────


def bands(flags, gap):
    """Непрерывные отрезки True; разрыв короче `gap` отрезок не рвёт."""
    out, start, empty, end = [], None, 0, 0
    for i, flag in enumerate(flags):
        if flag:
            if start is None:
                start = i
            empty, end = 0, i
        elif start is not None:
            empty += 1
            if empty >= gap:
                out.append((start, end))
                start = None
    if start is not None:
        out.append((start, end))
    return out


def find_sprites(image, gap=14, columns=None):
    """
    Спрайты построчно, слева направо: [[(x0, y0, x1, y1), ...], ...].

    Режет по пустым полосам. Если задано `columns` (сколько спрайтов в ряду по
    сетке листа), а полосы дали другое число — крыло или струя почти касаются
    соседа, — ряд режется по связным кускам: каждый кусок достаётся колонке
    сетки, над которой его середина.
    """
    alpha = image.getchannel('A').load()
    w, h = image.size
    rows = bands([sum(1 for x in range(w) if alpha[x, y]) > 2 for y in range(h)], gap)
    result = []
    for y0, y1 in rows:
        cols = bands([any(alpha[x, y] for y in range(y0, y1 + 1)) for x in range(w)], gap)
        row = []
        for x0, x1 in cols:
            box = image.crop((x0, y0, x1 + 1, y1 + 1)).getbbox()
            row.append((x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3]))
        if columns is not None and len(row) != columns:
            row = split_by_grid(alpha, w, y0, y1, columns)
        result.append(row)
    return result


def split_by_grid(alpha, w, y0, y1, columns, allow_empty=False):
    """
    Ряд — по связным кускам, куски — по колонкам сетки (см. find_sprites).
    `allow_empty` — колонки без спрайта выпадают (ряд короче сетки).
    """
    seen = set()
    boxes = [None] * columns
    for sy in range(y0, y1 + 1):
        for sx in range(w):
            if not alpha[sx, sy] or (sx, sy) in seen:
                continue
            seen.add((sx, sy))
            stack = [(sx, sy)]
            bx0, by0, bx1, by1 = sx, sy, sx, sy
            size = 0
            while stack:
                x, y = stack.pop()
                size += 1
                bx0, by0, bx1, by1 = min(bx0, x), min(by0, y), max(bx1, x), max(by1, y)
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and y0 <= ny <= y1 and (nx, ny) not in seen and alpha[nx, ny]:
                        seen.add((nx, ny))
                        stack.append((nx, ny))
            # Крошка чужого ряда, заехавшая за край полосы, — не наша.
            if allow_empty and size < 400 and (by0 == y0 or by1 == y1):
                continue
            column = min(columns - 1, int((bx0 + bx1) / 2 * columns / w))
            old = boxes[column]
            box = (bx0, by0, bx1 + 1, by1 + 1)
            boxes[column] = box if old is None else (
                min(old[0], box[0]), min(old[1], box[1]), max(old[2], box[2]), max(old[3], box[3]))
    if allow_empty:
        return [box for box in boxes if box is not None]
    assert all(box is not None for box in boxes), f'пустая колонка в ряду {y0}–{y1}'
    return boxes


def scaled(image, box, scale):
    """Вырезать и масштабировать с премультипликацией: без тёмной каймы."""
    piece = image.crop(box).convert('RGBa')
    size = (max(1, round(piece.width * scale)), max(1, round(piece.height * scale)))
    return piece.resize(size, Image.LANCZOS).convert('RGBA')


def place(sprite, width, height, anchor):
    """Кадр заданного размера; спрайт по центру или на нижнем крае."""
    frame = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    x = (width - sprite.width) // 2
    y = height - sprite.height if anchor == 'bottom' else (height - sprite.height) // 2
    frame.alpha_composite(sprite, (x, y))
    return frame


# ── листы ───────────────────────────────────────────────────────────────────


def tiles(frames):
    """Плитки и потиры: кадр в клетку, предмет по центру клетки."""
    image = key_out(Image.open(SOURCE / '1-tiles.png'))
    boxes = [box for row in find_sprites(image) for box in row]
    names = ['tile-stone', 'tile-thorn', 'tile-ash', 'tile-fog', 'tile-blood']
    names += [f'potion-{tier}' for tier in TIERS]
    assert len(boxes) == len(names), f'1-tiles: {len(boxes)} спрайтов вместо {len(names)}'
    # Предметы вытянуты вверх и площади клетки занимают мало — поэтому
    # в полную клетку по высоте.
    biggest = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes)
    scale = CELL * 1.0 / biggest
    for name, box in zip(names, boxes):
        frames[name] = place(scaled(image, box, scale), CELL, CELL, 'center')

    # Второй прогон (docs/art-prompts.md, лист A): светлые плитки. Есть лист —
    # плитки берутся из него, потиры пока остаются из первого. Лист пятого
    # прогона (`v4/`, плитка — цвета своей постройки) важнее.
    fresh = next(
        (SOURCE / run / 'a-tiles.png' for run in ('v4', 'v2') if (SOURCE / run / 'a-tiles.png').exists()),
        None,
    )
    if fresh is not None:
        image = key_out(Image.open(fresh))
        boxes = [box for row in find_sprites(image) for box in row]
        names = ['tile-stone', 'tile-thorn', 'tile-ash', 'tile-fog', 'tile-blood']
        assert len(boxes) == len(names), f'v2/a-tiles: {len(boxes)} спрайтов вместо {len(names)}'
        biggest = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes)
        scale = CELL * 1.0 / biggest
        for name, box in zip(names, boxes):
            frames[name] = place(scaled(image, box, scale), CELL, CELL, 'center')
        # Капля крови — со второго прогона: новые выходили то кубком (путается
        # с потиром), то странной каплей (решение 2026-09-30).
        old = SOURCE / 'v2' / 'a-tiles.png'
        if fresh.parent.name == 'v4' and old.exists():
            image = key_out(Image.open(old))
            boxes = [box for row in find_sprites(image) for box in row]
            biggest = max(max(b[2] - b[0], b[3] - b[1]) for b in boxes)
            frames['tile-blood'] = place(scaled(image, boxes[4], CELL * 1.0 / biggest), CELL, CELL, 'center')


def buildings(frames):
    """Постройки: шириной в клетку, на нижнем крае, высокие торчат вверх."""
    image = key_out(Image.open(SOURCE / '2-buildings.png'))
    rows = find_sprites(image)
    kinds = ['gargoyle', 'vine', 'mortar', 'fogveil']
    assert [len(row) for row in rows] == [4] * 4, f'2-buildings: {[len(r) for r in rows]}'
    # По высоте: самая высокая — 1,4 клетки. Выше — на плотном поле башни
    # сливаются в кучу; ширина при этом выходит около 0,8 клетки.
    tallest = max(b[3] - b[1] for row in rows for b in row)
    scale = CELL * 1.4 / tallest
    for kind, row in zip(kinds, rows):
        for tier, box in zip(TIERS, row):
            frames[f'{kind}-{tier}'] = on_base(scaled(image, box, scale))


def on_base(sprite):
    """
    Кадр шириной не меньше клетки; основание постройки чуть выше нижнего
    края — иначе она сидит на шве между клетками.
    """
    base = round(CELL * 0.04)
    frame = Image.new('RGBA', (max(CELL, sprite.width), sprite.height + base), (0, 0, 0, 0))
    frame.alpha_composite(sprite, ((frame.width - sprite.width) // 2, 0))
    return frame


def enemies(frames):
    """Враги: солдат ≈ 0,8 клетки, проповедник ≈ 1,9 — как в оригинале."""
    image = key_out(Image.open(SOURCE / '3-enemies.png'))
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [3, 4], f'3-enemies: {[len(r) for r in rows]}'
    for kind, row, height in (('hunter', rows[0], 0.8), ('preacher', rows[1], 1.9)):
        uniform(frames, image, row, [f'{kind}-{i + 1}' for i in range(len(row))], CELL * height)


def uniform(frames, image, boxes, names, height):
    """Кадры анимации: один масштаб, один размер кадра, ноги на нижнем крае."""
    tallest = max(b[3] - b[1] for b in boxes)
    scale = height / tallest
    sprites = [scaled(image, box, scale) for box in boxes]
    width = max(s.width for s in sprites)
    frame_height = max(s.height for s in sprites)
    for name, sprite in zip(names, sprites):
        frames[name] = place(sprite, width, frame_height, 'bottom')


def shots(frames):
    """Снаряды и эффекты: размеры — доли клетки, как у оригинала при 48."""
    image = key_out(Image.open(SOURCE / '4-shots.png'))
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [4, 4, 4, 3, 6], f'4-shots: {[len(r) for r in rows]}'

    def group(row, names, size, by='height'):
        extent = max((b[3] - b[1]) if by == 'height' else (b[2] - b[0]) for b in row)
        scale = CELL * size / extent
        for name, box in zip(names, row):
            frames[name] = scaled(image, box, scale)

    group(rows[0], [f'shot-gargoyle-{t}' for t in TIERS], 23 / 48)
    group(rows[1], [f'shot-vine-{t}' for t in TIERS], 48 / 48)
    group(rows[2], [f'shot-mortar-{t}' for t in TIERS], 11 / 48)
    group(rows[3][0:1], ['shot-explosion'], 30 / 48, 'width')
    group(rows[3][1:2], ['shot-shadow'], 12 / 48, 'width')
    group(rows[3][2:3], ['fx-death'], 31 / 48, 'width')
    uniform(frames, image, rows[4], [f'fx-fire-{i + 1}' for i in range(6)], CELL * 66 / 48)


def seamless(strip, search=0.3, blend=24):
    """
    Полоса облаков без шва: обрезать там, где столбец справа больше всего
    похож на первый, и сгладить стык коротким переходом.
    """
    w, h = strip.size
    px = strip.load()

    def column(x):
        return [px[x, y] for y in range(h)]

    first = column(0)

    def distance(x):
        return sum(
            abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2]) + 2 * abs(a[3] - b[3])
            for a, b in zip(first, column(x))
        )

    cut = min(range(int(w * (1 - search)), w), key=distance)
    out = strip.crop((0, 0, cut, h))
    tail = strip.crop((cut, 0, min(w, cut + blend), h))
    # Начало полосы плавно переходит из того, что шло бы после обреза.
    head = out.crop((0, 0, tail.width, h))
    for x in range(tail.width):
        k = (x + 1) / (tail.width + 1)
        mixed = Image.blend(tail.crop((x, 0, x + 1, h)), head.crop((x, 0, x + 1, h)), k)
        out.paste(mixed, (x, 0))
    return out


def flat_bottom(strip, rows=6):
    """Нижние ряды — одним цветом: им сцена заливает всё ниже полосы."""
    w, h = strip.size
    sample = sorted(strip.getpixel((x, h - rows - 2)) for x in range(0, w, 3))
    colour = sample[len(sample) // 2]
    for y in range(h - rows, h):
        for x in range(w):
            strip.putpixel((x, y), colour)
    return strip


def clouds(frames):
    """Облака: задняя — 3 клетки высотой, передняя — 2,3, как у оригинала."""
    # Второй прогон: туман вместо облаков (лист I). Нет листа — облака первого.
    fog = SOURCE / 'v2' / 'i-fog.png'
    image = key_out(Image.open(fog if fog.exists() else SOURCE / '5-clouds.png'))
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [1, 1], f'5-clouds: {[len(r) for r in rows]}'
    for name, row, cells in (('cloud-back', rows[0], 144 / 48), ('cloud-front', rows[1], 110 / 48)):
        _, y0, _, y1 = row[0]
        # По ширине — весь лист, от края до края; последние ряды у низа —
        # вперемешку с фоном, их срезаем.
        box = (0, y0, image.width, y1 - 3)
        strip = scaled(image, box, CELL * cells / (box[3] - box[1]))
        frames[name] = flat_bottom(seamless(strip))
    loader_fog(frames)


# Экран загрузки показывается до бандла и атласа: туман для него — отдельными
# маленькими картинками в public/ (index.html берёт их сразу).
LOADER = Path('public/loader')


def loader_fog(frames):
    LOADER.mkdir(parents=True, exist_ok=True)
    colors = {}
    for name, out in (('cloud-back', 'fog-back'), ('cloud-front', 'fog-front')):
        strip = frames[name]
        small = strip.resize((strip.width // 2, strip.height // 2), Image.LANCZOS)
        small.save(LOADER / f'{out}.png', optimize=True)
        r, g, b, _ = strip.getpixel((strip.width // 2, strip.height - 1))
        colors[out] = f'#{r:02x}{g:02x}{b:02x}'
    print('туман для экрана загрузки:', colors)


# ── упаковка ────────────────────────────────────────────────────────────────


# Поля вокруг облаков: полоса повторяется, и на стыке фильтр текстуры берёт
# соседние пиксели листа — там должно быть продолжение самой полосы.
EXTRUDE = 4


def extruded(name, frame):
    """Кадр с полями: у облаков — продолжение по кругу, у остальных — пусто."""
    e = EXTRUDE
    out = Image.new('RGBA', (frame.width + 2 * e, frame.height + 2 * e), (0, 0, 0, 0))
    if not name.startswith('cloud-'):
        out.alpha_composite(frame, (e, e))
        return out
    wide = Image.new('RGBA', (frame.width + 2 * e, frame.height), (0, 0, 0, 0))
    wide.paste(frame.crop((frame.width - e, 0, frame.width, frame.height)), (0, 0))
    wide.paste(frame, (e, 0))
    wide.paste(frame.crop((0, 0, e, frame.height)), (e + frame.width, 0))
    out.paste(wide, (0, e))
    for y in range(e):
        out.paste(wide.crop((0, 0, wide.width, 1)), (0, y))
        out.paste(wide.crop((0, wide.height - 1, wide.width, wide.height)), (0, e + frame.height + y))
    return out


def layout_blocks(names):
    """
    Порядок кадров на листе — по видам, чтобы атлас читался глазами. Блок —
    один вид: плитки с потирами; горгулья, лоза, мортира — по строке на
    ступень (покой, атака, снаряд этой ступени), внизу блока — попадания;
    завеса с врагами; эффекты; облака. Блоки стоят рядом, пока влезают по
    ширине, — иначе лист вышел бы выше 4096 точек, а столько держит не каждый
    телефон. Кадр, которого здесь нет, всё равно попадает на лист — в
    последний блок.
    """
    tiles = [[f'tile-{k}' for k in ('stone', 'thorn', 'ash', 'fog', 'blood')]]
    tiles += [[f'potion-{t}'] + [f'potion-{t}-drink-{i}' for i in (1, 2, 3)] for t in TIERS]
    tiles.append([f'fx-drink-{i}' for i in range(1, 5)])
    blocks = [tiles]
    for kind, frames in (
        ('gargoyle', ['attack-1', 'attack-2', 'attack-3']),
        ('vine', ['attack-up-1', 'attack-up-2', 'attack-down-1', 'attack-down-2']),
        ('mortar', ['fire', 'flash']),
    ):
        block = [[f'{kind}-{t}'] + [f'{kind}-{t}-{f}' for f in frames] + [f'shot-{kind}-{t}'] for t in TIERS]
        block.append([f'hit-{kind}-{i}' for i in range(1, 6)])
        blocks.append(block)
    blocks[-1][-1] += ['shot-explosion', 'shot-shadow']
    blocks.append([
        [f'fogveil-{t}' for t in TIERS],
        [f'hunter-{i}' for i in (1, 2, 3)] + [f'hunter-death-{i}' for i in range(1, 5)],
        [f'preacher-{i}' for i in range(1, 5)] + ['preacher-cast-1', 'preacher-cast-2', 'preacher-death-1', 'preacher-death-2'],
    ])
    blocks.append([
        [f'fx-merge-{i}' for i in range(1, 6)] + [f'fx-spawn-{i}' for i in range(1, 5)] + ['fx-death'],
        [f'fx-fire-{i}' for i in range(1, 8)],
    ])
    blocks.append([['cloud-back'], ['cloud-front']])
    placed = {name for block in blocks for line in block for name in line}
    blocks.append([sorted(name for name in names if name not in placed)])
    return [[[n for n in line if n in names] for line in block] for block in blocks]


def pack(frames):
    """Блоки `layout_blocks` полками слева направо; внутри блока — строки."""
    padded = {name: extruded(name, frame) for name, frame in frames.items()}
    positions = {}
    bx, by, shelf = 0, 0, 0
    for block in layout_blocks(set(padded)):
        lines = [line for line in block if line]
        if not lines:
            continue
        width = max(sum(padded[n].width for n in line) for line in lines)
        height = sum(max(padded[n].height for n in line) for line in lines)
        assert width <= SHEET_WIDTH, f'блок шире листа: {width} > {SHEET_WIDTH}'
        if bx > 0 and bx + width > SHEET_WIDTH:
            bx, by, shelf = 0, by + shelf, 0
        y = by
        for line in lines:
            x = bx
            for name in line:
                positions[name] = (x, y)
                x += padded[name].width
            y += max(padded[n].height for n in line)
        bx += width
        shelf = max(shelf, height)
    height = by + shelf
    sheet = Image.new('RGBA', (SHEET_WIDTH, height), (0, 0, 0, 0))
    rects = {}
    for name in frames:
        fx, fy = positions[name]
        sheet.alpha_composite(padded[name], (fx, fy))
        rects[name] = [fx + EXTRUDE, fy + EXTRUDE, frames[name].width, frames[name].height]
    return sheet, rects


def chalices(frames):
    """
    Второй прогон, лист B: потиры по ступеням с кадрами питья и брызги.
    Все кадры — в одном масштабе и на нижнем крае клетки: ножка кубка при
    наклоне стоит на месте.
    """
    path = SOURCE / 'v2' / 'b-chalices.png'
    if not path.exists():
        return
    image = key_out(Image.open(path))
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [4] * 5, f'v2/b-chalices: {[len(r) for r in rows]}'
    tallest = max(b[3] - b[1] for row in rows[:4] for b in row)
    scale = CELL * 0.96 / tallest
    for tier, row in zip(TIERS, rows[:4]):
        names = [f'potion-{tier}'] + [f'potion-{tier}-drink-{i}' for i in (1, 2, 3)]
        for name, box in zip(names, row):
            frames[name] = place(scaled(image, box, scale), CELL, CELL, 'bottom')
    for index, box in enumerate(rows[4], start=1):
        frames[f'fx-drink-{index}'] = place(scaled(image, box, scale), CELL, CELL, 'bottom')


def gargoyles(frames):
    """
    Второй прогон, лист C: горгульи — покой и три кадра атаки. Масштаб — по
    прежней горгулье, чтобы на поле она не выросла и не съёжилась; все кадры
    ступени — одного масштаба, постамент на месте.
    """
    image = v2('c-gargoyles.png')
    if image is None:
        return
    rows = find_sprites(image, columns=4)
    assert [len(row) for row in rows] == [4] * 4, f'v2/c-gargoyles: {[len(r) for r in rows]}'
    # Высота покоя — 1,15 клетки: горгулья на постаменте не должна торчать
    # над соседями выше завесы (решение 2026-09-29; раньше была 1,4).
    idle = max(row[0][3] - row[0][1] for row in rows)
    scale = CELL * GARGOYLE_HEIGHT / idle
    for tier, row in zip(TIERS, rows):
        names = [f'gargoyle-{tier}'] + [f'gargoyle-{tier}-attack-{i}' for i in (1, 2, 3)]
        for name, box in zip(names, row):
            frames[name] = on_base(scaled(image, box, scale))


def v2(name):
    """
    Лист второго прогона или None, если его ещё нет. Лист четвёртого прогона
    (`art/atlas/v4/`, свой цвет у каждой постройки) с тем же именем — важнее,
    но только если листа нет в третьем прогоне: тогда v4 нарисован по сетке
    третьего и достаётся `v3()` (лоза, мортира), а здесь остаётся старый.
    """
    runs = ('v2',) if (SOURCE / 'v3' / name).exists() else ('v4', 'v2')
    for run in runs:
        path = SOURCE / run / name
        if path.exists():
            return key_out(Image.open(path))
    return None


def union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


def vines(frames):
    """
    Лист D: лоза — покой и два кадра атаки. Кадр покачивания на листе есть, но
    в атлас не идёт: в покое постройки стоят неподвижно (решение 2026-09-29).
    """
    image = v2('d-vines.png')
    if image is None:
        return
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [4] * 4, f'v2/d-vines: {[len(r) for r in rows]}'
    old = max(frames[f'vine-{tier}'].height for tier in TIERS)
    idle = max(row[0][3] - row[0][1] for row in rows)
    scale = old / idle
    for tier, row in zip(TIERS, rows):
        names = [f'vine-{tier}', None, f'vine-{tier}-attack-1', f'vine-{tier}-attack-2']
        for name, box in zip(names, row):
            if name is not None:
                frames[name] = on_base(scaled(image, box, scale))


def mortars(frames):
    """
    Лист E: мортира нарисована частями — основание, ствол, ствол с отдачей и
    дымом, вспышка у дула. Ствол садится на основание здесь, при сборке: на
    поле мортира — один кадр покоя и один кадр выстрела, стволом вправо.
    """
    image = v2('e-mortars.png')
    if image is None:
        return
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [4] * 4, f'v2/e-mortars: {[len(r) for r in rows]}'
    old = max(frames[f'mortar-{tier}'].height for tier in TIERS)
    for tier, row in zip(TIERS, rows):
        base_box, barrel_box, fire_box, flash_box = row
        base = image.crop(base_box)
        barrels = [image.crop(barrel_box), image.crop(fire_box)]
        # Оба кадра — на одном холсте и с одной рамкой: иначе основание на
        # выстреле съехало бы вбок (дым шире ствола).
        at_x = base.width // 2 - barrels[0].width // 5
        width = max(base.width, at_x + max(b.width for b in barrels))
        top = max(0, max(b.height for b in barrels) - int(base.height * 0.55))
        canvases = []
        for barrel in barrels:
            canvas = Image.new('RGBA', (width, base.height + top), (0, 0, 0, 0))
            canvas.alpha_composite(base, (0, top))
            canvas.alpha_composite(barrel, (at_x, top + int(base.height * 0.45) - barrel.height))
            canvases.append(canvas)
        boxes = [canvas.getbbox() for canvas in canvases]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        idle_box = boxes[0]
        # Масштаб — по кадру покоя: не выше прежней мортиры и не шире клетки.
        scale = min(old / (idle_box[3] - idle_box[1]), CELL * 1.05 / (idle_box[2] - idle_box[0]))
        for name, canvas in zip((f'mortar-{tier}', f'mortar-{tier}-fire'), canvases):
            frames[name] = on_base(scaled(canvas, box, scale))
        frames[f'mortar-{tier}-flash'] = scaled(image, flash_box, CELL * 0.8 / (flash_box[2] - flash_box[0]))


def fogveils(frames):
    """
    Лист F: столб завесы и три кадра тумана вокруг основания. Кадры
    складываются здесь: туман клубится позади подножия и выглядывает по бокам.
    Поверх — нельзя: с пятого прогона подножие показывает ступень, и туман
    прятал бы её (а алый витраж Багровой просвечивал бы сквозь него).
    """
    image = v2('f-fogveils.png')
    if image is None:
        return
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [4] * 4, f'v2/f-fogveils: {[len(r) for r in rows]}'
    old = max(frames[f'fogveil-{tier}'].height for tier in TIERS)
    for tier, row in zip(TIERS, rows):
        totem = image.crop(row[0])
        for index, box in enumerate(row[1:], start=1):
            fog = image.crop(box)
            width = max(totem.width, fog.width)
            height = totem.height + fog.height // 4
            canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            fog_at = ((width - fog.width) // 2, height - fog.height)
            canvas.alpha_composite(fog, fog_at)
            canvas.alpha_composite(totem, ((width - totem.width) // 2, 0))
            scale = old / height
            # Завеса неподвижна: берём только первый кадр тумана.
            if index == 1:
                frames[f'fogveil-{tier}'] = on_base(scaled(canvas, canvas.getbbox(), scale))


def fogwalls_v6(frames):
    """
    Лист F шестого прогона: завеса — низкая преграда во всю клетку (ограда из
    камней, внутри туман), по ступени в клетке сетки 2×2. Неподвижна, кадр
    один; ширина — клетка, низ — на нижнем крае.
    """
    path = SOURCE / 'v4' / 'f-fogwalls.png'
    if not path.exists():
        return
    image = key_out(Image.open(path))
    boxes = [box for row in find_sprites(image, columns=2) for box in row]
    assert len(boxes) == 4, f'v4/f-fogwalls: {len(boxes)} спрайтов вместо 4'
    for tier, box in zip(TIERS, boxes):
        frames[f'fogveil-{tier}'] = on_base(scaled(image, box, CELL * 0.98 / (box[2] - box[0])))


def enemies_v2(frames):
    """
    Лист G: солдат — три шага и четыре кадра гибели; Проповедник — четыре
    шага, два кадра молитвы и два кадра гибели. Все кадры одного героя — в
    одном масштабе, ноги на нижнем крае.
    """
    image = v2('g-enemies.png')
    if image is None:
        return
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [3, 5, 4, 4], f'v2/g-enemies: {[len(r) for r in rows]}'
    # Факел лежащего солдата нарисован отдельно от тела — это один кадр.
    death = rows[1][:2] + [union(rows[1][2], rows[1][3])] + rows[1][4:]
    for kind, walk, dying, height in (
        ('hunter', rows[0], death, 1.0),
        ('preacher', rows[2], rows[3], 1.9),
    ):
        boxes = walk + dying
        tallest = max(b[3] - b[1] for b in walk)
        scale = CELL * height / tallest
        sprites = [scaled(image, box, scale) for box in boxes]
        width = max(s.width for s in sprites)
        frame_height = max(s.height for s in sprites)
        names = [f'{kind}-{i + 1}' for i in range(len(walk))]
        if kind == 'hunter':
            names += [f'hunter-death-{i + 1}' for i in range(len(dying))]
        else:
            names += ['preacher-cast-1', 'preacher-cast-2', 'preacher-death-1', 'preacher-death-2']
        for name, sprite in zip(names, sprites):
            frames[name] = place(sprite, width, frame_height, 'bottom')


def shots_v2(frames):
    """
    Лист H: снаряды по ступеням, попадания, взрыв ядра, тень, вспышка
    слияния, пламя и пыль выхода. Размеры — как у первого прогона (доли клетки).
    """
    image = v2('h-shots.png')
    if image is None:
        return
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [4, 4, 4, 8, 4, 5, 7, 4], f'v2/h-shots: {[len(r) for r in rows]}'

    def group(boxes, names, size, by='height'):
        extent = max((b[3] - b[1]) if by == 'height' else (b[2] - b[0]) for b in boxes)
        scale = CELL * size / extent
        for name, box in zip(names, boxes):
            frames[name] = scaled(image, box, scale)

    group(rows[0], [f'shot-gargoyle-{t}' for t in TIERS], 23 / 48)
    group(rows[1], [f'shot-vine-{t}' for t in TIERS], 48 / 48)
    group(rows[2], [f'shot-mortar-{t}' for t in TIERS], 13 / 48)
    group(rows[3][:3], [f'hit-gargoyle-{i + 1}' for i in range(3)], 26 / 48, 'width')
    group(rows[3][3:], [f'hit-vine-{i + 1}' for i in range(5)], 26 / 48, 'width')
    group(rows[4][:3], [f'hit-mortar-{i + 1}' for i in range(3)], 34 / 48, 'width')
    # Взрыв ядра в игре — один кадр, что растёт и гаснет: средний из трёх.
    frames['shot-explosion'] = frames['hit-mortar-2']
    group(rows[4][3:], ['shot-shadow'], 12 / 48, 'width')
    uniform(frames, image, rows[5], [f'fx-merge-{i + 1}' for i in range(5)], CELL * 1.0)
    uniform(frames, image, rows[6], [f'fx-fire-{i + 1}' for i in range(7)], CELL * 66 / 48)
    uniform(frames, image, rows[7], [f'fx-spawn-{i + 1}' for i in range(4)], CELL * 0.8)


def shots_v5(frames):
    """
    Лист H пятого прогона: снаряды и попадания в цвете своего вида — ледяной
    осколок горгульи, кислотный шип лозы, бронзовое ядро мортиры. Вспышка
    слияния, пламя, пыль и тень остаются со второго прогона. Попаданий на листе
    по три кадра — прежние кадры попаданий убираем, чтобы не смешались.
    """
    path = SOURCE / 'v4' / 'h-projectiles.png'
    if not path.exists():
        return
    image = key_out(Image.open(path))
    # Искры и струи почти касаются соседнего ряда — ряды режем по сетке листа
    # (шесть равных полос), а спрайты внутри ряда — как обычно.
    counts = [4, 4, 4, 3, 3, 3]
    band = image.height / len(counts)
    rows = []
    for index, count in enumerate(counts):
        top = round(index * band)
        bottom = round((index + 1) * band)
        # Сначала — по пустым промежуткам внутри полосы; не сошлось — по сетке:
        # 4 колонки (попадания в первых трёх) или столько, сколько спрайтов
        # (попадания разложены на всю ширину).
        alpha = image.getchannel('A').load()
        strip = image.crop((0, top, image.width, bottom))
        cols = bands([any(alpha[x, y] for y in range(top, bottom)) for x in range(image.width)], 14)
        found = []
        if len(cols) == count:
            for x0, x1 in cols:
                box = strip.crop((x0, 0, x1 + 1, strip.height)).getbbox()
                found.append((x0 + box[0], top + box[1], x0 + box[2], top + box[3]))
        for grid in (4, count):
            if len(found) != count:
                found = split_by_grid(alpha, image.width, top, bottom - 1, grid, True)
        assert len(found) == count, f'v4/h-projectiles, ряд {index + 1}: {len(found)} вместо {count}'
        rows.append(found)

    def group(boxes, names, size, by='height'):
        extent = max((b[3] - b[1]) if by == 'height' else (b[2] - b[0]) for b in boxes)
        scale = CELL * size / extent
        for name, box in zip(names, boxes):
            frames[name] = scaled(image, box, scale)

    for name in [n for n in frames if n.startswith('hit-')]:
        del frames[name]
    group(rows[0], [f'shot-gargoyle-{t}' for t in TIERS], 23 / 48)
    # Шип лозы — в полклетки, как осколок горгульи: в клетку он закрывал
    # цель (решение 2026-09-30).
    group(rows[1], [f'shot-vine-{t}' for t in TIERS], 24 / 48)
    group(rows[2], [f'shot-mortar-{t}' for t in TIERS], 13 / 48)
    group(rows[3], [f'hit-gargoyle-{i + 1}' for i in range(3)], 26 / 48, 'width')
    group(rows[4], [f'hit-vine-{i + 1}' for i in range(3)], 26 / 48, 'width')
    group(rows[5], [f'hit-mortar-{i + 1}' for i in range(3)], 34 / 48, 'width')
    frames['shot-explosion'] = frames['hit-mortar-2']


def v3(name):
    """Лист третьего прогона или None; лист четвёртого с тем же именем — важнее."""
    for run in ('v4', 'v3'):
        path = SOURCE / run / name
        if path.exists():
            return key_out(Image.open(path))
    return None


def vines_v3(frames):
    """
    Лист D третьего прогона: покой и атака вверх и вниз, по два кадра.

    Струя атаки вверх упирается в лозу ряда выше, поэтому ряды режутся не по
    пустым полосам, а по линии земли: низу холмика у кадра покоя (первый
    столбец). Всё, что ниже земли, — струя вниз — отрезается: иначе кадр
    выстрела встал бы на поле выше покоя, и лоза подпрыгивала бы.
    """
    image = v3('d-vines.png')
    if image is None:
        return
    alpha = image.getchannel('A').load()
    w, h = image.size
    cols = bands([any(alpha[x, y] for y in range(h)) for x in range(w)], 14)
    assert len(cols) == 5, f'v3/d-vines: {len(cols)} столбцов вместо 5'
    x0, x1 = cols[0]
    ground = [y1 for _, y1 in bands([any(alpha[x, y] for x in range(x0, x1 + 1)) for y in range(h)], 14)]
    assert len(ground) == 4, f'v3/d-vines: {len(ground)} рядов вместо 4'
    old = max(frames[f'vine-{tier}'].height for tier in TIERS)
    boxes = []
    for r, bottom in enumerate(ground):
        top = 0 if r == 0 else ground[r - 1] + 1
        row = []
        for cx0, cx1 in cols:
            piece = image.crop((cx0, top, cx1 + 1, bottom + 1))
            # Хвост струи ряда выше залетает в этот — отрезаем то, что сверху
            # оторвано от лозы пустой полосой.
            pa = piece.getchannel('A').load()
            spans = bands([any(pa[x, y] for x in range(piece.width)) for y in range(piece.height)], 20)
            keep_top = spans[-1][0]
            box = piece.crop((0, keep_top, piece.width, piece.height)).getbbox()
            row.append((cx0 + box[0], top + keep_top + box[1], cx0 + box[2], top + keep_top + box[3]))
        boxes.append(row)
    idle = max(row[0][3] - row[0][1] for row in boxes)
    scale = old / idle
    for tier, row in zip(TIERS, boxes):
        frames.pop(f'vine-{tier}-attack-1', None)
        frames.pop(f'vine-{tier}-attack-2', None)
        names = [f'vine-{tier}'] + [f'vine-{tier}-attack-{d}-{i}' for d in ('up', 'down') for i in (1, 2)]
        for name, box in zip(names, row):
            frames[name] = on_base(scaled(image, box, scale))


def mortars_v3(frames):
    """Лист E третьего прогона: мортира целиком — покой, выстрел, вспышка."""
    image = v3('e-mortars.png')
    if image is None:
        return
    rows = find_sprites(image)
    assert [len(row) for row in rows] == [3] * 4, f'v3/e-mortars: {[len(r) for r in rows]}'
    old = max(frames[f'mortar-{tier}'].height for tier in TIERS)
    for tier, (idle, fire, flash) in zip(TIERS, rows):
        # Лафет — 85 % ширины клетки: с зазором от соседей, чуть мельче
        # остальных построек — мортира приземистая и не должна их давить.
        idle_w = idle[2] - idle[0]
        scale = min(old / (idle[3] - idle[1]), CELL * 0.85 / idle_w)
        # Дым выстрела торчит вправо: поле по обе стороны одинаковое, чтобы
        # лафет в обоих кадрах стоял по центру клетки и на одном месте.
        pad = max(0, (fire[2] - fire[0]) - idle_w)
        width = idle_w + 2 * pad
        height = max(idle[3] - idle[1], fire[3] - fire[1])
        for name, part in ((f'mortar-{tier}', idle), (f'mortar-{tier}-fire', fire)):
            piece = image.crop(part)
            canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            canvas.alpha_composite(piece, (pad, height - piece.height))
            frames[name] = on_base(scaled(canvas, (0, 0, width, height), scale))
        flame = flame_only(image, flash, idle) if holds_body(image, flash, idle) else None
        if flame is None:
            frames[f'mortar-{tier}-flash'] = scaled(image, flash, CELL * 0.8 / (flash[2] - flash[0]))
        else:
            frames[f'mortar-{tier}-flash'] = scaled(flame, (0, 0, flame.width, flame.height), CELL * 0.8 / flame.width)


def is_fire(r, g, b):
    return r > 200 and g > 110 and b < 140 and r - b > 110


def holds_body(image, box, idle_box):
    """
    В кадре вспышки нарисована и сама мортира (пятый прогон), а не одна
    вспышка: силуэт покоя, совмещённый по левому нижнему углу, почти весь
    закрыт этим кадром.
    """
    piece = image.crop(box).getchannel('A').load()
    idle = image.crop(idle_box).getchannel('A').load()
    w, h = box[2] - box[0], box[3] - box[1]
    iw, ih = idle_box[2] - idle_box[0], idle_box[3] - idle_box[1]
    body = covered = 0
    for y in range(ih):
        for x in range(iw):
            if not idle[x, y]:
                continue
            body += 1
            py = y - ih + h
            covered += 1 if 0 <= x < w and 0 <= py < h and piece[x, py] else 0
    return covered > 0.8 * body


def flame_only(image, box, idle_box):
    """
    Вспышка из кадра, где генератор нарисовал её вместе с мортирой (пятый
    прогон): берём только огненные точки — жёлтые и оранжевые — вне силуэта
    мортиры в покое (кадры совмещены по левому нижнему углу), иначе в огонь
    попало бы золото лафета.
    """
    piece = image.crop(box)
    px = piece.load()
    idle = image.crop(idle_box).getchannel('A').load()
    idle_w, idle_h = idle_box[2] - idle_box[0], idle_box[3] - idle_box[1]
    dy = (idle_box[3] - idle_box[1]) - (box[3] - box[1])

    def in_body(x, y):
        iy = y + dy
        return 0 <= x < idle_w and 0 <= iy < idle_h and idle[x, iy] > 0

    out = Image.new('RGBA', piece.size, (0, 0, 0, 0))
    po = out.load()
    for y in range(piece.height):
        for x in range(piece.width):
            r, g, b, a = px[x, y]
            if a and is_fire(r, g, b) and not in_body(x, y):
                po[x, y] = (r, g, b, a)
    bbox = out.getbbox()
    return None if bbox is None else out.crop(bbox)


def main():
    frames = {}
    tiles(frames)
    buildings(frames)
    chalices(frames)
    gargoyles(frames)
    vines(frames)
    vines_v3(frames)
    mortars(frames)
    mortars_v3(frames)
    fogveils(frames)
    fogwalls_v6(frames)
    enemies(frames)
    enemies_v2(frames)
    shots(frames)
    shots_v2(frames)
    shots_v5(frames)
    clouds(frames)
    sheet, rects = pack(frames)
    TARGET.mkdir(parents=True, exist_ok=True)
    # Палитра в 256 цветов без дизеринга: для пиксельного арта на глаз без
    # потерь, а весит впятеро меньше — это первая загрузка игры. WebP — только
    # без потерь и без пересжатия размера: кадры atlas.json стоят в точках листа.
    palette = sheet.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    palette.convert('RGBA').save(TARGET / 'texture.webp', lossless=True, quality=100, method=6, exact=True)
    atlas = {
        'cell': CELL,
        # Размер листа: по нему интерфейс (справка) режет кадры через CSS.
        'size': [sheet.width, sheet.height],
        'frames': rects,
        'anims': {
            # Солдат — три кадра туда-обратно, как в оригинале.
            'hunter': ['hunter-1', 'hunter-2', 'hunter-3', 'hunter-2'],
            'preacher': [f'preacher-{i + 1}' for i in range(4)],
            **(
                {
                    'hunter-death': [f'hunter-death-{i + 1}' for i in range(4)],
                    'preacher-death': ['preacher-death-1', 'preacher-death-2'],
                }
                if 'hunter-death-1' in frames
                else {}
            ),
            'fx-fire': [f'fx-fire-{i + 1}' for i in range(7 if 'fx-fire-7' in frames else 6)],
            **({'fx-merge': [f'fx-merge-{i + 1}' for i in range(5)]} if 'fx-merge-1' in frames else {}),
            **({'fx-spawn': [f'fx-spawn-{i + 1}' for i in range(4)]} if 'fx-spawn-1' in frames else {}),
        },
    }
    (TARGET / 'atlas.json').write_text(json.dumps(atlas, indent=2) + '\n')
    print(f'texture.webp {sheet.width}×{sheet.height}, {len(rects)} кадров')


if __name__ == '__main__':
    main()
