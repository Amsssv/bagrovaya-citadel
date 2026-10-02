#!/usr/bin/env python3
"""
Скриншоты для карточки игры на Яндексе: компьютер — 16:9, 1920×1080,
телефон — 9:16, 1080×1920 (другие пропорции площадка не принимает).

    python3 scripts/catalog-screens.py

Берёт `art/catalog/screens/<язык>/raw/{phone,desktop}-*.png` (сняты в 2×),
уменьшает и кладёт готовые в `art/catalog/screens/<язык>/{mobile,desktop}/`.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / 'art' / 'catalog' / 'screens'
SIZES = {'phone': (1080, 1920), 'desktop': (1920, 1080)}


def main():
    for lang in sorted(p for p in ROOT.iterdir() if (p / 'raw').is_dir()):
        for kind, folder in (('phone', 'mobile'), ('desktop', 'desktop')):
            out = lang / folder
            out.mkdir(exist_ok=True)
            for source in sorted((lang / 'raw').glob(f'{kind}-*.png')):
                image = Image.open(source).convert('RGB')
                image = image.resize(SIZES[kind], Image.LANCZOS)
                target = out / source.name.removeprefix(f'{kind}-')
                image.save(target, optimize=True)
                print(f'{target.relative_to(ROOT)}: {image.width}×{image.height}')


if __name__ == '__main__':
    main()
