import { t } from '@/shared/lib/i18n';
import { Icon } from '@/shared/ui';

import { bloodCaption, bloodDrops, dropsWord } from './meter';

import styles from './BloodMeter.module.scss';

/**
 * Кровь на эту ночь — ряд капель под большим пальцем.
 *
 * Капля наливается с коротким толчком: выпитый потир и длинный матч должны
 * быть заметны, а не менять цифру молча. Толчок даёт сама смена класса, без
 * счёта «что было до», — поэтому при первом показе полные капли тоже вздрогнут
 * разок.
 */
export interface BloodMeterProps {
  readonly swaps: number;
  readonly perNight: number;
}

export function BloodMeter({ swaps, perNight }: BloodMeterProps) {
  const drops = bloodDrops(swaps, perNight);

  return (
    <div className={styles.meter}>
      <div
        className={styles.drops}
        role="img"
        aria-label={`${t('blood.blood')}: ${String(swaps)} ${dropsWord(swaps)}`}
      >
        {Array.from({ length: perNight }, (_, index) => (
          <span key={index} className={index < drops.full ? styles.full : styles.empty}>
            <Icon name="drop" size={30} />
          </span>
        ))}
        {drops.extra > 0 && (
          <span className={styles.extra} key={`extra-${String(drops.extra)}`}>
            +{drops.extra}
          </span>
        )}
      </div>
      <p className={styles.caption}>{bloodCaption(swaps)}</p>
    </div>
  );
}
