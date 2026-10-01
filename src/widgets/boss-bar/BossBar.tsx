import { useEffect, useState } from 'react';

import { t } from '@/shared/lib/i18n';
import { Sprite, hasSprite } from '@/shared/ui';

import styles from './BossBar.module.scss';

/**
 * Жизни Проповедника внизу, пока он на поле, — как у матери драконов в
 * оригинале: при выходе полоска наливается, от попадания вспыхивает алым,
 * слева — его портрет.
 */
export interface BossBarProps {
  readonly hp: number;
  readonly max: number;
  /** Только что попали — полоска вспыхивает. */
  readonly hit: boolean;
}

export function BossBar({ hp, max, hit }: BossBarProps) {
  const share = max > 0 ? Math.min(1, Math.max(0, hp / max)) : 0;
  // Выход — полоска наливается от нуля, как в оригинале.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setShown(share);
    });
    return () => cancelAnimationFrame(frame);
  }, [share]);
  const name = t('boss.thePreacher');
  return (
    <div
      className={styles.root}
      role="meter"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={hp}
    >
      {hasSprite('preacher-1') && (
        <span className={styles.face}>
          <Sprite frame="preacher-1" size={34} />
        </span>
      )}
      <div className={styles.body}>
        <div className={styles.head}>
          <b>{name}</b>
          <span>{Math.max(0, Math.ceil(hp))}</span>
        </div>
        <div className={styles.track}>
          <div className={styles.fill} style={{ transform: `scaleX(${String(shown)})` }} />
          {hit && <div className={styles.flash} key={hp} />}
        </div>
      </div>
    </div>
  );
}
