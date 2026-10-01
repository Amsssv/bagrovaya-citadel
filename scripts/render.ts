import type { Board } from '@/entities/board';

/** Поле текстом — для демо-скриптов в терминале. */
const GLYPH: Record<string, string> = {
  stone: '·',
  thorn: '˟',
  ash: '˙',
  fog: '~',
  blood: '°',
  gargoyle: 'Г',
  vine: 'Л',
  mortar: 'М',
  fogveil: 'Т',
};

export function render(board: Board): string {
  const rows: string[] = [];
  for (let y = 0; y < board.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < board.width; x++) {
      const cell = board.cells[y * board.width + x];
      if (cell === undefined) continue;
      if (cell.kind === 'tile') row.push(GLYPH[cell.resource] ?? '?');
      else if (cell.kind === 'building') row.push(GLYPH[cell.building] ?? '?');
      else if (cell.kind === 'potion') row.push('П');
      else row.push(' ');
    }
    rows.push(`  ${row.join(' ')}`);
  }
  return rows.join('\n');
}
