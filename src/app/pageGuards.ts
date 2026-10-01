/**
 * Страница ведёт себя как игра, а не как сайт (требования Яндекс Игр): нет
 * контекстного меню, выделения и зума. CSS (`global.scss`) закрывает почти
 * всё, но не везде:
 *
 *   • Android Chrome по долгому нажатию показывает меню вопреки CSS — его
 *     гасит только `contextmenu`, как в matching-game;
 *   • iOS Safari игнорирует `user-scalable=no` и зумит щипком — `gesturestart`;
 *   • на компьютере Ctrl + колесо и Ctrl + «+/−» масштабируют страницу.
 *
 * Возвращает отписку.
 */
export function installPageGuards(target: Window = window): () => void {
  const stop = (event: Event): void => {
    event.preventDefault();
  };
  const wheel = (event: WheelEvent): void => {
    if (event.ctrlKey) event.preventDefault();
  };
  const keys = (event: KeyboardEvent): void => {
    if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) {
      event.preventDefault();
    }
  };
  const doc = target.document;
  doc.addEventListener('contextmenu', stop);
  doc.addEventListener('gesturestart', stop);
  doc.addEventListener('selectstart', stop);
  target.addEventListener('wheel', wheel, { passive: false });
  target.addEventListener('keydown', keys);
  return () => {
    doc.removeEventListener('contextmenu', stop);
    doc.removeEventListener('gesturestart', stop);
    doc.removeEventListener('selectstart', stop);
    target.removeEventListener('wheel', wheel);
    target.removeEventListener('keydown', keys);
  };
}
