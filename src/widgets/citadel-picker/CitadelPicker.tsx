import type { CitadelLevelId } from '@/entities/citadel';
import { levelHint, levelName, t } from '@/shared/lib/i18n';
import { Sheet, buttons } from '@/shared/ui';

import type { PickerRow } from './picker';

import styles from './CitadelPicker.module.scss';

/**
 * Выбор цитадели (§12). Открыты все три сразу — условий открытия спека не даёт.
 *
 * Подпись на кнопке говорит о последствии до нажатия: уход в другую цитадель
 * бросает текущий забег, и узнать об этом после — худшее, что можно сделать.
 */

export interface CitadelPickerProps {
  readonly rows: readonly PickerRow[];
  readonly onPick: (id: CitadelLevelId) => void;
  readonly onClose: () => void;
}

export function CitadelPicker({ rows, onPick, onClose }: CitadelPickerProps) {
  return (
    <Sheet title={t('picker.citadels')} onClose={onClose}>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li className={row.isCurrent ? styles.itemCurrent : styles.item} key={row.level.id}>
            <div className={styles.top}>
              <span className={styles.name}>{levelName(row.level)}</span>
              {row.isCurrent && <span className={styles.here}>{t('picker.youAreHere')}</span>}
            </div>
            <span className={styles.hint}>{levelHint(row.level)}</span>
            <span className={styles.best}>
              {t('picker.best')}: {row.best.score} {t('plural.points', { count: row.best.score })},{' '}
              {row.best.nights} {t('plural.nights', { count: row.best.nights })}
            </span>
            <button
              className={row.action === 'start' ? buttons.primary : buttons.secondary}
              type="button"
              onClick={() => {
                onPick(row.level.id);
              }}
            >
              {t(`picker.action.${row.action}`)}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
