import { t } from '@/shared/lib/i18n';
import { Sheet, buttons } from '@/shared/ui';

import type { RecordsView } from './records';

import styles from './RecordsPanel.module.scss';

/** Первые три места — медалями, как в matching-game. */
const MEDALS: readonly string[] = ['🥇', '🥈', '🥉'];

/**
 * Летопись рекордов.
 *
 * Своя строка стоит первой и есть всегда — играть можно без регистрации (§13).
 * Таблица площадки идёт следом; её отсутствие — обычное состояние, а не сбой,
 * поэтому вместо ошибки пишем, почему её нет.
 */
export interface RecordsPanelProps {
  readonly view: RecordsView;
  readonly onSignIn: () => void;
  readonly onClose: () => void;
}

export function RecordsPanel({ view, onSignIn, onClose }: RecordsPanelProps) {
  return (
    <Sheet
      title={t('records.chronicle')}
      onClose={onClose}
      footer={
        view.canSignIn && (
          <button className={buttons.primary} type="button" onClick={onSignIn}>
            {t('records.signInToEnter')}
          </button>
        )
      }
    >
      <div className={styles.mine}>
        <span className={styles.mineLabel}>{t('records.yourBest')}</span>
        <span className={styles.mineValue}>
          <b>{view.best.score}</b> {t('plural.points', { count: view.best.score })}
        </span>
        <span className={styles.mineNights}>
          {view.best.nights} {t('plural.nights', { count: view.best.nights })}
        </span>
      </div>

      {view.state.kind === 'offline' && (
        <p className={styles.note}>{t('records.thePlatformIsUnavailable')}</p>
      )}
      {view.state.kind === 'empty' && (
        <p className={styles.note}>{t('records.theChronicleIsEmpty')}</p>
      )}
      {view.state.kind === 'table' && (
        <ol className={styles.rows}>
          {view.state.rows.map((row) =>
            row === 'gap' ? (
              <li className={styles.gap} key="gap" aria-hidden="true">
                · · ·
              </li>
            ) : (
              <li className={row.isPlayer ? styles.rowMine : styles.row} key={row.rank}>
                <span className={styles.rank}>{MEDALS[row.rank - 1] ?? row.rank}</span>
                <span className={styles.name}>{row.name}</span>
                <span className={styles.score}>{row.score}</span>
              </li>
            ),
          )}
        </ol>
      )}
    </Sheet>
  );
}
