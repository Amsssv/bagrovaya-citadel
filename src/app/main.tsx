// Вход в игру — нарочно крошечный. Площадка держит свой экран загрузки, пока
// страница не загрузилась (событие `load`), а бандл игры весит мегабайты. Поэтому
// он грузится уже после `load`: экран Яндекса уходит, как только готов наш экран
// из index.html, и скачивание игры игрок видит на нём.
function start(): void {
  void import('./start');
}

if (document.readyState === 'complete') start();
else window.addEventListener('load', start, { once: true });
