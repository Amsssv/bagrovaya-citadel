import { useEffect, useId, useRef, useState } from 'react';

import { t } from '@/shared/lib/i18n';
import { Icon } from '@/shared/ui';

import type { SoundChannel, SoundSettings } from './sound';
import { isSilent, toggleMuted, withVolume } from './sound';
import styles from './SoundControl.module.scss';

/**
 * Настройки в шапке: кнопка с шестерёнкой, под ней — звук (выключатель и
 * громкость музыки и эффектов) и переключатели игры. Закрывается касанием
 * мимо и Escape, как выбор языка.
 */
export interface SettingToggle {
  readonly label: string;
  readonly on: boolean;
  readonly onChange: (on: boolean) => void;
}

export interface SoundControlProps {
  readonly settings: SoundSettings;
  /** Громкость по умолчанию — ею выключатель включает звук с нулей. */
  readonly fallback: SoundSettings;
  readonly onChange: (next: SoundSettings) => void;
  /** Переключатели под звуком. */
  readonly toggles?: readonly SettingToggle[];
}

export function SoundControl({ settings, fallback, onChange, toggles = [] }: SoundControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const musicId = useId();
  const sfxId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = t('settings.settings');
  const silent = isSilent(settings);

  const slider = (channel: SoundChannel, id: string, name: string) => (
    <div className={styles.row}>
      <label className={styles.label} htmlFor={id}>
        {name}
      </label>
      <input
        id={id}
        className={styles.range}
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round((settings.muted ? 0 : settings[channel]) * 100)}
        onChange={(event) => {
          onChange(withVolume(settings, channel, Number(event.target.value) / 100));
        }}
      />
    </div>
  );

  return (
    <div className={styles.root} ref={ref}>
      <button
        className={open ? styles.triggerOpen : styles.trigger}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Icon name="gear" />
      </button>

      {open && (
        <div className={styles.pop} role="dialog" aria-label={label}>
          <button
            className={silent ? styles.toggle : styles.toggleOn}
            type="button"
            aria-pressed={!settings.muted}
            onClick={() => {
              onChange(toggleMuted(settings, fallback));
            }}
          >
            <Icon name={silent ? 'mute' : 'sound'} size={18} />
            {silent ? t('settings.soundOff') : t('settings.soundOn')}
          </button>
          {slider('music', musicId, t('settings.music'))}
          {slider('sfx', sfxId, t('settings.effects'))}
          {toggles.map((toggle) => (
            <label className={styles.check} key={toggle.label}>
              <input
                type="checkbox"
                checked={toggle.on}
                onChange={(event) => {
                  toggle.onChange(event.target.checked);
                }}
              />
              <span>{toggle.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
