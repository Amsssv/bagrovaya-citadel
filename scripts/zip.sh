#!/usr/bin/env sh
# Архив для загрузки на Яндекс Игры: содержимое dist/ с index.html в корне.
#
# Собирать заново перед каждой упаковкой — дело `npm run zip`; этот скрипт
# только пакует то, что уже лежит в dist/. Старый архив удаляется: `zip -r`
# дописывает в существующий, и в нём копились бы бандлы прошлых сборок.
set -eu

cd "$(dirname "$0")/.."
OUT="bagrovaya-citadel.zip"

if [ ! -f dist/index.html ]; then
  echo "Нет dist/index.html — сначала соберите игру: npm run build" >&2
  exit 1
fi

rm -f "$OUT"
(cd dist && zip -qr "../$OUT" . -x '*.map' -x '.DS_Store')

SIZE=$(du -h "$OUT" | cut -f1)
FILES=$(unzip -Z1 "$OUT" | wc -l | tr -d ' ')
echo "Готово: $OUT — $SIZE, файлов: $FILES"
