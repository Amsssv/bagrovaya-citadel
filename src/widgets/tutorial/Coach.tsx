import type { CSSProperties } from 'react';

import styles from './Coach.module.scss';

/**
 * Подсказка обучения у хода, как в оригинале: всё затемнено, кроме окна над
 * тем, что нужно сделать; рука показывает жест; рядом — что будет.
 *
 * Затемнение — четыре блока вокруг окна, а не маска: блоки не пропускают
 * касания, а в окне касания доходят до поля или кнопки — туда и нужно.
 * Без окна — одна подсказка, ничего не затемнено и не заблокировано (бой).
 */
export interface CoachRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type CoachGesture = 'drag' | 'tap';

export interface CoachProps {
  /** Окно, в пикселях окна браузера; null — без затемнения. */
  readonly hole: CoachRect | null;
  /** Жест руки: тянуть от `from` к `to` или касание в `from`. */
  readonly gesture?: CoachGesture;
  readonly from?: { readonly x: number; readonly y: number };
  readonly to?: { readonly x: number; readonly y: number };
  readonly title: string;
  readonly text: string;
}

/** Выше этой отметки окна подсказка встаёт под ним: сверху — шапка. */
const BUBBLE_BELOW_UNDER = 240;

export function Coach({ hole, gesture = 'drag', from, to, title, text }: CoachProps) {
  const bubbleAt: CSSProperties =
    hole === null
      ? { top: 'calc(var(--safe-top) + 6.5rem)' }
      : hole.y < BUBBLE_BELOW_UNDER
        ? { top: hole.y + hole.height + 16 }
        : { bottom: `calc(100% - ${String(hole.y - 16)}px)` };
  const start = from ?? { x: 0, y: 0 };
  const end = gesture === 'tap' ? start : (to ?? start);
  const hand = {
    '--from-x': `${String(start.x)}px`,
    '--from-y': `${String(start.y)}px`,
    '--to-x': `${String(end.x)}px`,
    '--to-y': `${String(end.y)}px`,
  } as CSSProperties;
  return (
    <div className={styles.root} role={hole === null ? 'status' : 'dialog'} aria-label={title}>
      {hole !== null && (
        <>
          <div className={styles.shade} style={{ left: 0, top: 0, right: 0, height: hole.y }} />
          <div
            className={styles.shade}
            style={{ left: 0, top: hole.y + hole.height, right: 0, bottom: 0 }}
          />
          <div
            className={styles.shade}
            style={{ left: 0, top: hole.y, width: hole.x, height: hole.height }}
          />
          <div
            className={styles.shade}
            style={{ left: hole.x + hole.width, top: hole.y, right: 0, height: hole.height }}
          />
          <div
            className={styles.hole}
            style={{ left: hole.x, top: hole.y, width: hole.width, height: hole.height }}
          />
        </>
      )}
      {from !== undefined && (
        <div
          className={gesture === 'tap' ? styles.tap : styles.hand}
          style={hand}
          aria-hidden="true"
        />
      )}
      <div className={styles.bubble} style={bubbleAt}>
        <b>{title}</b>
        <span>{text}</span>
      </div>
    </div>
  );
}
