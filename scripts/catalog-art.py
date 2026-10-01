#!/usr/bin/env python3
"""
Картинки для карточки игры на Яндексе: иконка PNG 512×512 и обложка PNG 800×470.

Генератор рисует в своём размере (просим 1024×1024 и 1600×940, приходит как
придётся) — скрипт обрезает по центру до нужных пропорций и ужимает.

    python3 scripts/catalog-art.py icon  путь/к/картинке.png
    python3 scripts/catalog-art.py cover путь/к/картинке.png

Готовое кладётся в `art/catalog/icon.png` и `art/catalog/cover.png`.
"""
import sys
from pathlib import Path

from PIL import Image

SIZES = {'icon': (512, 512), 'cover': (800, 470)}
OUT = Path(__file__).resolve().parent.parent / 'art' / 'catalog'


def fit(image, width, height):
    """Обрезка по центру до пропорций width:height и ужатие до ровного размера."""
    ratio = width / height
    w, h = image.size
    if w / h > ratio:
        cut = round(h * ratio)
        image = image.crop(((w - cut) // 2, 0, (w - cut) // 2 + cut, h))
    else:
        cut = round(w / ratio)
        image = image.crop((0, (h - cut) // 2, w, (h - cut) // 2 + cut))
    return image.resize((width, height), Image.LANCZOS)


def main():
    if len(sys.argv) != 3 or sys.argv[1] not in SIZES:
        sys.exit(__doc__)
    kind, source = sys.argv[1], Path(sys.argv[2])
    image = fit(Image.open(source).convert('RGB'), *SIZES[kind])
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f'{kind}.png'
    image.save(target, optimize=True)
    print(f'{target}: {image.width}×{image.height}, {target.stat().st_size // 1024} КБ')


if __name__ == '__main__':
    main()
