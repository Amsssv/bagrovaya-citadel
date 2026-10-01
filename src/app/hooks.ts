import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Надпись, которая висит `ms` и гаснет сама. Каждый новый показ получает свой
 * `key` — по нему элемент перезапускает анимацию, даже если текст тот же.
 */
export function useFlash<T extends object>(
  ms: number,
): readonly [(T & { readonly key: number }) | null, (value: T) => void] {
  const [flash, setFlash] = useState<(T & { readonly key: number }) | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const timer = window.setTimeout(() => setFlash(null), ms);
    return () => window.clearTimeout(timer);
  }, [flash, ms]);
  const show = useCallback((value: T) => {
    setFlash({ ...value, key: Date.now() });
  }, []);
  return [flash, show];
}

/**
 * Сколько экрана снизу занимает подвал вместе с безопасной зоной телефона.
 * Канвас лежит под всем экраном, подвал — поверх облаков; поле под подвал
 * заходить не должно.
 */
export function useReserveBottom(footerRef: RefObject<HTMLElement | null>): number {
  const [reserve, setReserve] = useState(0);
  useEffect(() => {
    const footer = footerRef.current;
    const screen = footer?.parentElement;
    if (footer === null || footer === undefined || screen === null || screen === undefined) return;
    const measure = (): void => {
      // Подвал без раскладки (скрыт, ещё не встал) даёт top = 0 и «занимает»
      // весь экран — поле схлопнулось бы. Такой замер пропускаем.
      if (footer.offsetHeight === 0) return;
      setReserve(screen.getBoundingClientRect().bottom - footer.getBoundingClientRect().top);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    observer.observe(footer);
    return () => observer.disconnect();
  }, [footerRef]);
  return reserve;
}

/** Вкладка скрыта. */
export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const onVisibility = (): void => {
      setHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  return hidden;
}
