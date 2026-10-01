import type { CSSProperties } from 'react';

import { cssColor, waterColor } from '@/widgets/board';

import styles from './Water.module.scss';

/**
 * Вода за игрой, на весь экран шире 1280: канвас со своей водой не шире
 * игры, а по бокам широкого окна должна быть та же вода, без шва.
 *
 * Два слоя — ночь и день — меняются прозрачностью за то же время, что и
 * свет на поле, поэтому вода в канвасе и за ним темнеет и светлеет вместе.
 */
export interface WaterProps {
  readonly day: boolean;
  /** Сколько идёт смена, мс: совпадает со сменой света на поле. */
  readonly durationMs: number;
}

const COLORS = {
  '--water-night': cssColor(waterColor(0)),
  '--water-day': cssColor(waterColor(1)),
};

export function Water({ day, durationMs }: WaterProps) {
  const style = {
    ...COLORS,
    '--water-ms': `${String(Math.round(durationMs))}ms`,
  } as CSSProperties;
  return (
    <div className={day ? styles.waterDay : styles.water} style={style} aria-hidden="true">
      <div className={styles.day} />
    </div>
  );
}
