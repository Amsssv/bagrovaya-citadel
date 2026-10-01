import buttons from './Button.module.scss';
import styles from './ConfirmSheet.module.scss';
import { Sheet } from './Sheet';
import { Sprite, hasSprite } from './Sprite';

/**
 * Подтверждение: «Сдаться?», «Выбросить постройку?». Первое действие —
 * главная кнопка, остальные — второстепенные; отмена — крестиком, мимо
 * панели или Escape.
 */
export interface ConfirmAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ConfirmSheetProps {
  readonly title: string;
  readonly text: string;
  /** Кадр атласа рядом с текстом — что именно выбрасываем. */
  readonly frame?: string;
  readonly actions: readonly ConfirmAction[];
  readonly onClose: () => void;
}

export function ConfirmSheet({ title, text, frame, actions, onClose }: ConfirmSheetProps) {
  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={actions.map((action, index) => (
        <button
          key={action.label}
          className={index === 0 ? buttons.primary : buttons.secondary}
          type="button"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    >
      <div className={styles.body}>
        {frame !== undefined && hasSprite(frame) && (
          <span className={styles.art}>
            <Sprite frame={frame} size={56} />
          </span>
        )}
        <p className={styles.text}>{text}</p>
      </div>
    </Sheet>
  );
}
