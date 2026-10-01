import type { Board, Cell } from '../types';
import { EMPTY, building, potion, tile } from '../types';

/**
 * Поле из текстовой картинки — чтобы тест читался как то, что он проверяет.
 *
 *   строчные — сырые плитки: s камень · t терновник · a прах · f туман · b кровь
 *   ЗАГЛАВНЫЕ — занятые клетки: G горгулья · V лоза · M мортира · W завеса · P потир
 *   точка — пусто
 *
 * Верхняя строка — ряд у цитадели (y = 0), туда приходят новые плитки.
 * Пробелы между символами не обязательны, но с ними картинка читаемее.
 */
const GLYPHS: Readonly<Record<string, Cell>> = {
  '.': EMPTY,
  s: tile('stone'),
  t: tile('thorn'),
  a: tile('ash'),
  f: tile('fog'),
  b: tile('blood'),
  G: building('gargoyle', 'raw'),
  V: building('vine', 'raw'),
  M: building('mortar', 'raw'),
  W: building('fogveil', 'raw'),
  P: potion('raw'),
};

export function boardFrom(picture: string): Board {
  const rows = picture
    .split('\n')
    .map((row) => row.replace(/\s/g, ''))
    .filter((row) => row.length > 0);

  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error('Пустая картинка поля');
  if (rows.some((row) => row.length !== width)) {
    throw new Error('Строки картинки разной длины');
  }

  const cells = rows.flatMap((row) =>
    [...row].map((glyph) => {
      const cell = GLYPHS[glyph];
      if (!cell) throw new Error(`Неизвестный символ поля: ${glyph}`);
      return cell;
    }),
  );

  return { width, height: rows.length, cells };
}

/** Обратно в картинку — для читаемых сообщений об ошибке в тестах. */
export function pictureOf(board: Board): string {
  const byCell = (cell: Cell): string => {
    const found = Object.entries(GLYPHS).find(
      ([, candidate]) => JSON.stringify(candidate) === JSON.stringify(cell),
    );
    return found?.[0] ?? '?';
  };

  const rows: string[] = [];
  for (let y = 0; y < board.height; y++) {
    const row = board.cells.slice(y * board.width, (y + 1) * board.width).map(byCell);
    rows.push(row.join(' '));
  }
  return rows.join('\n');
}
