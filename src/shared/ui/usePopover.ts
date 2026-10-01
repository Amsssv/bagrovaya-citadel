import { useEffect, useRef, useState } from 'react';

/**
 * Выпадающее окно у кнопки: открывается по кнопке, закрывается касанием мимо
 * и Escape. `ref` вешается на общий корень кнопки и окна — касание внутри
 * него окно не закрывает.
 */
export function usePopover<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);

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

  return { open, setOpen, ref } as const;
}
