import type { PlatformAdapter, Storage } from '@/shared/api';
import { createBrowserStorage } from '@/shared/api';
import type { Lang } from '@/shared/lib/i18n';
import { LANGS, resolveLang, setLang, t } from '@/shared/lib/i18n';

/**
 * Сколько ждём SDK ради языка. Площадка обычно поднимается за доли секунды;
 * если она зависла, игра не должна висеть вместе с ней — стартуем на языке
 * браузера, а init тем временем доедет сам и остальное подхватит App.
 */
const SDK_WAIT_MS = 5000;

/**
 * Язык, выбранный игроком вручную. Отдельно от сейва: сейв читается уже в App,
 * а язык нужен раньше — до первого кадра.
 */
export const LANG_STORAGE_KEY = 'bagrovaya-citadel-lang';

function isLang(value: string | null): value is Lang {
  return value !== null && (LANGS as readonly string[]).includes(value);
}

/**
 * Язык игры по порядку:
 *   1. `?lang=en` в адресе — для проверки перевода вне площадки;
 *   2. выбор игрока в переключателе — он сильнее автоопределения;
 *   3. `environment.i18n.lang` из SDK — это и есть требование площадки;
 *   4. язык браузера — когда игра запущена не на Яндексе.
 *
 * Площадку поднимаем в любом случае: она нужна игре и помимо языка.
 */
export async function detectLang(
  platform: PlatformAdapter,
  storage: Storage = createBrowserStorage(),
): Promise<Lang> {
  const ready = Promise.race([
    platform.init(),
    new Promise<void>((resolve) => setTimeout(resolve, SDK_WAIT_MS)),
  ]);

  // Язык площадки читаем всегда, даже когда его перебьёт выбор игрока:
  // отладочная панель Яндекса засчитывает п. 2.14 («I18N is used»), только
  // если игра прочла environment.i18n.lang (BUG-003 в matching-game).
  await ready;
  const detected = resolveLang(platform.isReady() ? platform.getLang() : navigator.language);

  const forced = new URLSearchParams(window.location.search).get('lang');
  if (isLang(forced)) return forced;

  const chosen = storage.read(LANG_STORAGE_KEY);
  if (isLang(chosen)) return chosen;

  return detected;
}

/** Запомнить ручной выбор игрока. */
export function saveLangChoice(lang: Lang, storage: Storage = createBrowserStorage()): void {
  storage.write(LANG_STORAGE_KEY, lang);
}

/** Выставить язык игре и тому, что index.html нарисовал до бандла. */
export function applyLang(lang: Lang): void {
  setLang(lang);
  document.documentElement.lang = lang;

  const title = t('app.crimsonCitadel');
  document.title = title;
  const loader = document.getElementById('app-loader');
  loader?.setAttribute('aria-label', t('app.loading'));
  const loaderTitle = loader?.querySelector('.app-loader__title');
  if (loaderTitle) loaderTitle.textContent = title;
}
