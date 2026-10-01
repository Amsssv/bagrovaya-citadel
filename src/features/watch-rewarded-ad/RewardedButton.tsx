import { useCallback, useState } from 'react';

import { t } from '@/shared/lib/i18n';

import styles from './RewardedButton.module.scss';

/**
 * Кнопка «посмотреть ролик за награду».
 *
 * Пока ролик на экране, кнопка заблокирована: второй показ подряд площадка не
 * даст, а повторное нажатие оставило бы игрока ждать впустую. Рекламы нет —
 * кнопки нет вовсе, а не серая заглушка.
 */
export interface RewardedButtonProps {
  readonly available: boolean;
  readonly label: string;
  /** Показать ролик. Возвращает заработанное: ноль — награды не было. */
  readonly onWatch: () => Promise<number>;
}

export function RewardedButton({ available, label, onWatch }: RewardedButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(() => {
    setBusy(true);
    void onWatch().finally(() => {
      setBusy(false);
    });
  }, [onWatch]);

  if (!available) return null;

  return (
    <button className={styles.rewarded} type="button" disabled={busy} onClick={handleClick}>
      {busy ? t('ads.video') : label}
    </button>
  );
}
