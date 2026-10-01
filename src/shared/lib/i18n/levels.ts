import type { MessageKey } from './translate';
import { t } from './translate';

/**
 * Имена и подсказки цитаделей — в словарях, `levels.<id>.name` и `.hint`.
 * Цитадель, которой в словаре нет, показывается под именем из `levels.json`,
 * а не пустой строкой и не ключом.
 */
interface NamedLevel {
  readonly id: string;
  readonly name: string;
  readonly hint: string;
}

function levelText(level: NamedLevel, field: 'name' | 'hint'): string {
  const key = `levels.${level.id}.${field}` as MessageKey;
  const text = t(key);
  return text === key ? level[field] : text;
}

export function levelName(level: NamedLevel): string {
  return levelText(level, 'name');
}

export function levelHint(level: NamedLevel): string {
  return levelText(level, 'hint');
}
