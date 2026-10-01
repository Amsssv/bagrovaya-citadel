import { t } from '@/shared/lib/i18n';
import { Sheet, buttons } from '@/shared/ui';

import styles from './RunOverPanel.module.scss';

/**
 * Цитадель пала: итог забега и путь дальше.
 *
 * Главное действие одно — начать заново здесь же, в той же цитадели. Смена
 * цитадели — второе: чаще всего после поражения хотят реванша, а не выбора.
 * Закрыть панель нельзя — только починить цитадель или начать заново:
 * закрытие касанием мимо панели отнимало ремонт за ролик, а вернуть панель
 * было нечем.
 */
export interface RunOverPanelProps {
  readonly nights: number;
  readonly score: number;
  readonly isRecord: boolean;
  /**
   * Починить цитадель за ролик — один раз за сессию. Нет — кнопки нет: уже
   * чинили, или ролик недоступен.
   */
  readonly onRepair?: (() => void) | undefined;
  /** Ролик идёт — кнопка ремонта ждёт. */
  readonly repairing?: boolean;
  readonly onRestart: () => void;
  /** Выбор другой цитадели; нет — кнопки нет (пока цитадель одна). */
  readonly onPickCitadel?: (() => void) | undefined;
}

export function RunOverPanel({
  nights,
  score,
  isRecord,
  onRepair,
  repairing = false,
  onRestart,
  onPickCitadel,
}: RunOverPanelProps) {
  return (
    <Sheet
      title={t('runOver.theCitadelHasFallen')}
      footer={
        <>
          {onRepair !== undefined && (
            <button
              className={buttons.primary}
              type="button"
              disabled={repairing}
              onClick={onRepair}
            >
              {repairing ? t('runOver.video') : t('runOver.repairTheCitadelWatch')}
            </button>
          )}
          <button
            className={onRepair !== undefined ? buttons.secondary : buttons.primary}
            type="button"
            onClick={onRestart}
          >
            {t('runOver.startOver')}
          </button>
          {onPickCitadel !== undefined && (
            <button className={buttons.secondary} type="button" onClick={onPickCitadel}>
              {t('runOver.chooseAnotherCitadel')}
            </button>
          )}
        </>
      }
    >
      <p className={styles.lead}>{t('runOver.lead')}</p>

      <dl className={styles.result}>
        <div className={styles.cell}>
          <dt>{t('runOver.nights')}</dt>
          <dd>{nights}</dd>
        </div>
        <div className={styles.cell}>
          <dt>{t('runOver.score')}</dt>
          <dd>{score}</dd>
        </div>
      </dl>

      <p className={styles.lead}>{t('runOver.score100PerNight')}</p>

      {isRecord && <p className={styles.record}>{t('runOver.newRecord')}</p>}

      {onRepair !== undefined && <p className={styles.lead}>{t('runOver.oncePerSessionThe')}</p>}
    </Sheet>
  );
}
