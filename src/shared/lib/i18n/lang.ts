/**
 * Язык игры. Поддерживаем два: русский и английский.
 *
 * Требование площадки (п. 2.14): язык определяется автоматически, по
 * `environment.i18n.lang` из SDK. Площадка отдаёт код ISO 639-1 — `ru`, `en`,
 * `tr`, `kk`… Всё, чего у нас нет, сводим к ближайшему: языки СНГ, где
 * русский понимают все, — к русскому, остальное — к английскому.
 *
 * Язык выбирается один раз при запуске, до первого кадра интерфейса, и дальше
 * не меняется. Поэтому хранится здесь, в модуле, а не в состоянии React:
 * строки можно брать откуда угодно синхронно.
 */
export type Lang = 'ru' | 'en';

export const LANGS: readonly Lang[] = ['ru', 'en'];

/** Где русский понимают все: игроку оттуда показываем русскую версию. */
const RUSSIAN_SPEAKING = new Set(['ru', 'be', 'kk', 'uk', 'uz', 'ky', 'tg', 'hy', 'az']);

/** Код от площадки или браузера (`ru`, `en-US`, `KK`) → наш язык. */
export function resolveLang(raw: string | null | undefined): Lang {
  // Регион отрезаем: en-US, ru_RU → en, ru.
  const code = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-_].*$/, '');
  if (code === '') return 'ru';
  return RUSSIAN_SPEAKING.has(code) ? 'ru' : 'en';
}

let current: Lang = 'ru';

export function setLang(lang: Lang): void {
  current = lang;
}

export function getLang(): Lang {
  return current;
}
