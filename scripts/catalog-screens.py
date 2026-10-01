#!/usr/bin/env python3
"""
Скриншоты для карточки игры на Яндексе — 16:9, 1920×1080.

Площадка принимает только 16:9, а игра на телефоне вертикальная (9:16), поэтому
кадр телефона ставится по центру горизонтального, а за ним — тот же кадр,
размытый и затемнённый. Кадры компьютера уже 16:9 и копируются как есть.

    python3 scripts/catalog-screens.py

Берёт `art/catalog/screens/<язык>/raw/{phone,desktop}-*.png`, кладёт готовые в
`art/catalog/screens/<язык>/{mobile,desktop}/`.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent / 'art' / 'catalog' / 'screens'
SIZE = (1920, 1080)
# Кадр телефона — почти во всю высоту, со скруглёнными углами, как экран.
PHONE_HEIGHT = 1000
RADIUS = 36


def cover(image, size):
    """Растянуть с обрезкой, чтобы закрыть всё поле."""
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    x = (resized.width - size[0]) // 2
    y = (resized.height - size[1]) // 2
    return resized.crop((x, y, x + size[0], y + size[1]))


def landscape(phone):
    """Вертикальный кадр телефона на горизонтальном фоне из него же."""
    back = cover(phone, SIZE).filter(ImageFilter.GaussianBlur(28))
    back = Image.blend(back, Image.new('RGB', SIZE, (12, 6, 20)), 0.55)

    width = round(phone.width * PHONE_HEIGHT / phone.height)
    front = phone.resize((width, PHONE_HEIGHT), Image.LANCZOS)
    mask = Image.new('L', front.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, PHONE_HEIGHT - 1), RADIUS, fill=255)

    x = (SIZE[0] - width) // 2
    y = (SIZE[1] - PHONE_HEIGHT) // 2
    shadow = Image.new('L', SIZE, 0)
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 12, x + width, y + PHONE_HEIGHT + 12), RADIUS, fill=170)
    back.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(24)))
    back.paste(front, (x, y), mask)
    return back


def main():
    for lang in sorted(p for p in ROOT.iterdir() if (p / 'raw').is_dir()):
        for kind, folder in (('phone', 'mobile'), ('desktop', 'desktop')):
            out = lang / folder
            out.mkdir(exist_ok=True)
            for source in sorted((lang / 'raw').glob(f'{kind}-*.png')):
                image = Image.open(source).convert('RGB')
                image = landscape(image) if kind == 'phone' else image.resize(SIZE, Image.LANCZOS)
                target = out / source.name.removeprefix(f'{kind}-')
                image.save(target, optimize=True)
                print(f'{target.relative_to(ROOT)}: {image.width}×{image.height}')


if __name__ == '__main__':
    main()
