import type { Lang } from '@/shared/lib/i18n';
import { LANGS, t } from '@/shared/lib/i18n';
import { Icon, usePopover } from '@/shared/ui';

import styles from './LanguageSelect.module.scss';

/**
 * Выбор языка в шапке — как в `matching-game`: кнопка с глобусом и кодом
 * языка, под ней выпадающий список. Закрывается касанием мимо и Escape.
 *
 * Язык сам определяется по площадке (п. 2.14); здесь игрок может его
 * переопределить, и выбор запоминается.
 */
const NAMES: Readonly<Record<Lang, string>> = {
  ru: 'Русский',
  en: 'English',
};

export interface LanguageSelectProps {
  readonly current: Lang;
  readonly onPick: (lang: Lang) => void;
}

export function LanguageSelect({ current, onPick }: LanguageSelectProps) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();

  const label = t('lang.language');

  return (
    <div className={styles.root} ref={ref}>
      <button
        className={open ? styles.triggerOpen : styles.trigger}
        type="button"
        title={label}
        aria-label={`${label}: ${NAMES[current]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Icon name="globe" />
        <span className={styles.code}>{current.toUpperCase()}</span>
      </button>

      {open && (
        <ul className={styles.pop} role="listbox" aria-label={label}>
          {LANGS.map((lang) => (
            <li key={lang} role="option" aria-selected={lang === current}>
              <button
                className={lang === current ? styles.optionOn : styles.option}
                type="button"
                lang={lang}
                onClick={() => {
                  setOpen(false);
                  if (lang !== current) onPick(lang);
                }}
              >
                <span className={styles.optionCode}>{lang.toUpperCase()}</span>
                {NAMES[lang]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
