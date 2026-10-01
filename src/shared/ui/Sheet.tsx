import type { ReactNode } from 'react';
import { useEffect, useId, useRef } from 'react';

import { t } from '@/shared/lib/i18n';

import { Icon } from './Icon';

import styles from './Sheet.module.scss';

/**
 * Панель поверх игры: на телефоне шторка снизу, под большой палец, на широком
 * экране — карточка по центру.
 *
 * Закрывается тремя способами, которых ждут по привычке: крестиком, нажатием
 * мимо панели и клавишей Escape. Фокус при открытии уходит в панель, при
 * закрытии возвращается туда, откуда её открыли, — иначе с клавиатуры после
 * закрытия теряешься.
 *
 * Без `onClose` панель не закрывается ничем, кроме своих кнопок: ни крестика,
 * ни подложки, ни Escape. Для решений, которые нельзя пропустить случайным
 * касанием.
 */
export interface SheetProps {
  readonly title: string;
  readonly onClose?: (() => void) | undefined;
  readonly children: ReactNode;
  /** Кнопки под содержимым: не прокручиваются вместе с ним. */
  readonly footer?: ReactNode;
}

export function Sheet({ title, onClose, children, footer }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    panel.current?.focus();

    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        // Только по самой подложке: нажатие внутри панели не должно её закрыть.
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className={styles.head}>
          <h2 className={styles.title} id={titleId}>
            {title}
          </h2>
          {onClose !== undefined && (
            <button
              className={styles.close}
              type="button"
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          )}
        </header>

        <div className={styles.body}>{children}</div>

        {footer !== undefined && <footer className={styles.foot}>{footer}</footer>}
      </section>
    </div>
  );
}
