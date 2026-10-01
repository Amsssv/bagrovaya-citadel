"""
Камни, кораллы и сухие деревья для воды вокруг поля — вырезаны из самой
картинки поля, чтобы вода на весь экран была того же арта, что и у поля.

Скрипт берёт предметы из полос воды на `field.webp`, делает воду вокруг них
прозрачной (светлая рябь у камней остаётся — с ней камень стоит в воде) и
пишет лист `water-decor.png` и кадры `water-decor.json` рядом с картинкой
поля. Координаты предметов — прямоугольники на `field.webp`; если картинка
поля сменится, их нужно снять заново (docs/atlas.md → «Вода»).

Запуск: python3 scripts/water-decor.py (нужен Pillow).
"""

import json
from pathlib import Path

from PIL import Image

BOARD = Path('src/shared/assets/board')

# Кадр → прямоугольник на field.webp: (x0, y0, x1, y1), включительно.
PIECES = {
    'rock-large-1': (49, 528, 157, 628),
    'rock-large-2': (47, 1138, 155, 1238),
    'rock-medium-1': (86, 116, 171, 196),
    'rock-medium-2': (84, 727, 170, 810),
    'rock-medium-3': (1550, 1876, 1636, 1954),
    'rock-small-1': (67, 978, 139, 1045),
    'rock-small-2': (98, 1395, 161, 1457),
    'rock-small-3': (73, 2085, 134, 2151),
    'coral-1': (83, 223, 134, 287),
    'coral-2': (80, 832, 132, 897),
    'coral-3': (89, 1278, 142, 1345),
    'coral-4': (64, 1962, 114, 2024),
    'tree-1': (18, 1541, 150, 1899),
    'tree-2': (1538, 1295, 1667, 1627),
}
# Сколько воды оставить вокруг предмета, точек.
PAD = 4


def is_water(pixel):
    """Вода — тёмный насыщенный фиолетовый; рябь и блики светлее — не вода."""
    r, g, b, a = pixel
    if a < 250:
        return True
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return b - g > 45 and lum < 52


def cut(field, box):
    x0, y0, x1, y1 = box
    piece = field.crop((x0 - PAD, y0 - PAD, x1 + 1 + PAD, y1 + 1 + PAD))
    pixels = piece.load()
    for y in range(piece.height):
        for x in range(piece.width):
            if is_water(pixels[x, y]):
                pixels[x, y] = (0, 0, 0, 0)
    return piece


def main():
    field = Image.open(BOARD / 'field.webp').convert('RGBA')
    pieces = {name: cut(field, box) for name, box in PIECES.items()}

    # Лист — в одну строку: предметов мало, упаковка не нужна.
    width = sum(piece.width for piece in pieces.values()) + len(pieces)
    height = max(piece.height for piece in pieces.values())
    sheet = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    frames = {}
    x = 0
    for name, piece in pieces.items():
        sheet.paste(piece, (x, 0))
        frames[name] = [x, 0, piece.width, piece.height]
        x += piece.width + 1

    sheet.save(BOARD / 'water-decor.png', optimize=True)
    (BOARD / 'water-decor.json').write_text(json.dumps({'frames': frames}, indent=2) + '\n')
    print(f'water-decor.png: {len(frames)} кадров, {width}×{height}')


if __name__ == '__main__':
    main()
