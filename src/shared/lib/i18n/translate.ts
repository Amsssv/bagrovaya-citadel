import { getLang } from './lang';
import en from './locales/en.json';
import ru from './locales/ru.json';
import { pluralEn, pluralRu } from './plural';

/**
 * Перевод по ключу. Все строки игры лежат в `locales/ru.json` и `en.json` —
 * одинаковые ключи, разный язык; переводчику хватает одного файла.
 *
 *   t('hud.hearts')                        → «Сердца»
 *   t('boss.inNights', { count: 7 })       → подстановка `{count}` в строку
 *   t('plural.nights', { count: 7 })       → «ночей»: у ключа формы
 *                                             `{ one, few, many }` (ru) или
 *                                             `{ one, other }` (en)
 *
 * Ключи проверяет TypeScript: их список берётся из `ru.json`, и опечатка в
 * ключе — ошибка сборки. Что в `en.json` те же ключи — проверяет тест.
 */
type Messages = typeof ru;

/** Форма числа: у ключа с ней вместо строки — склонения. */
interface PluralLeaf {
  readonly one: string;
}

/** Все пути до строк и склонений: `a.b.c`. */
type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends PluralLeaf
      ? `${Prefix}${K}`
      : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;

export type MessageParams = Readonly<Record<string, string | number>>;

const DICTIONARIES: Readonly<Record<'ru' | 'en', unknown>> = { ru, en };

function lookup(dictionary: unknown, key: string): unknown {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function interpolate(text: string, params: MessageParams | undefined): string {
  if (params === undefined) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Строка по ключу на текущем языке. Нет перевода — русская, нет и её — ключ. */
export function t(key: MessageKey, params?: MessageParams): string {
  const lang = getLang();
  const value = lookup(DICTIONARIES[lang], key) ?? lookup(DICTIONARIES.ru, key);
  if (typeof value === 'string') return interpolate(value, params);
  if (typeof value === 'object' && value !== null && 'one' in value) {
    const count = Number(params?.['count'] ?? 0);
    // Все формы на месте — это проверяет тест словарей.
    const forms = value as { one: string; few: string; many: string; other: string };
    const word =
      lang === 'ru'
        ? pluralRu(count, [forms.one, forms.few, forms.many])
        : pluralEn(count, [forms.one, forms.other]);
    return interpolate(word, params);
  }
  return key;
}

/** Ключи словаря — для тестов на полноту перевода. */
export function keysOf(dictionary: unknown, prefix = ''): string[] {
  if (typeof dictionary !== 'object' || dictionary === null) return [prefix];
  if ('one' in dictionary) return [prefix];
  return Object.entries(dictionary).flatMap(([key, value]) =>
    keysOf(value, prefix === '' ? key : `${prefix}.${key}`),
  );
}
