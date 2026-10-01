/**
 * Иконки интерфейса. Свои, а не эмодзи: эмодзи на каждом телефоне нарисованы
 * по-своему, и в тёмную готику их яркие мультяшные сердечки не вписываются.
 *
 * Линия в 1.75 на сетке 24: толще не читается как тонкая гравюра, тоньше
 * пропадает на дешёвом экране. Цвет — от текста (`currentColor`).
 */
export type IconName =
  | 'heart'
  | 'moon'
  | 'swap'
  | 'castle'
  | 'scroll'
  | 'help'
  | 'close'
  | 'skip'
  | 'spark'
  | 'drop'
  | 'globe'
  | 'undo'
  | 'sound'
  | 'mute'
  | 'flag'
  | 'gear';

const PATHS: Readonly<Record<IconName, string>> = {
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z',
  swap: 'M7 4 3.5 7.5 7 11M3.5 7.5H16M17 13l3.5 3.5L17 20M20.5 16.5H8',
  castle: 'M4 20V9h2V6h2v3h2V6h4v3h2V6h2v3h2v11M4 20h16M10 20v-4a2 2 0 0 1 4 0v4M4 12h16',
  scroll:
    'M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7M7 4a2 2 0 0 0-2 2v2h2M7 4v16a2 2 0 0 1-2-2v-1M10 9h6M10 13h6',
  help: 'M9.2 9.2A2.9 2.9 0 0 1 12 7a2.8 2.8 0 0 1 2.9 2.8c0 2.2-2.9 2.3-2.9 4.4M12 17.2v.1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  close: 'M6 6l12 12M18 6 6 18',
  drop: 'M12 3.5c3.2 4.3 6 7.8 6 11a6 6 0 0 1-12 0c0-3.2 2.8-6.7 6-11Z',
  skip: 'M5 6l7 6-7 6V6ZM12 6l7 6-7 6V6ZM20 5v14',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.6 2.4 2.6 15.6 0 18M12 3c-2.6 2.4-2.6 15.6 0 18',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  mute: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5ZM16 9.5l5 5M21 9.5l-5 5',
  flag: 'M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.5 7.5 0 0 1-2 1.2L14.8 21h-3.6l-.3-2.4a7.5 7.5 0 0 1-2-1.2l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-3L5 9.3l2-3.4 1.9.7a7.5 7.5 0 0 1 2-1.2L11.2 3h3.6l.3 2.4a7.5 7.5 0 0 1 2 1.2l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 3Z',
  spark:
    'M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7ZM19 16v4M17 18h4',
};

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly className?: string | undefined;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
