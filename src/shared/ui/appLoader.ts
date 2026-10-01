/**
 * Экран загрузки живёт в index.html и рисуется до бандла. Отсюда — только
 * управление: сколько загружено и когда убрать. Если экрана нет (тесты,
 * встраивание), вызовы ничего не делают.
 */
interface AppLoader {
  set(progress: number): void;
  hide(): void;
}

declare global {
  interface Window {
    __appLoader?: AppLoader;
  }
}

/** Доля загруженного, 0..1. */
export function reportLoading(progress: number): void {
  window.__appLoader?.set(progress);
}

/** Игра готова: экран гаснет и убирается из DOM. */
export function hideLoading(): void {
  window.__appLoader?.hide();
}
