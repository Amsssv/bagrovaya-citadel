import { useEffect, useRef } from 'react';

import { t } from '@/shared/lib/i18n';
import { Sprite, hasSprite } from '@/shared/ui';

import styles from './TipCard.module.scss';

/**
 * Карточка обучения: картинка из атласа, пара строк и «Понятно». Пока она
 * открыта, поле ждёт — подложка лёгкая, но касания держит.
 */
export interface TipCardProps {
  /** Кадр атласа; нет в атласе — карточка без картинки. */
  readonly frame?: string;
  readonly title: string;
  readonly text: string;
  /** Строка цифр под текстом — у осмотра постройки. */
  readonly note?: string;
  /**
   * На поле подсвечена зона атаки: карточка опускается к самому низу экрана,
   * поверх шкалы крови, и не затемняет поле — зону должно быть видно.
   */
  readonly low?: boolean;
  readonly onDismiss: () => void;
}

export function TipCard({ frame, title, text, note, low = false, onDismiss }: TipCardProps) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
  }, []);
  return (
    <div className={low ? `${styles.backdrop} ${styles.low}` : styles.backdrop}>
      <section className={styles.card} role="dialog" aria-modal="true" aria-label={title}>
        {frame !== undefined && hasSprite(frame) && (
          <span className={styles.art}>
            <Sprite frame={frame} size={64} />
          </span>
        )}
        <div className={styles.body}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.text}>{text}</p>
          {note !== undefined && note !== '' && <p className={styles.note}>{note}</p>}
        </div>
        <button ref={button} className={styles.ok} type="button" onClick={onDismiss}>
          {t('common.gotIt')}
        </button>
      </section>
    </div>
  );
}
