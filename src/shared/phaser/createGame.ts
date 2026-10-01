import Phaser from 'phaser';

/**
 * Во сколько раз канвас плотнее CSS-пикселей. Без этого на телефоне (DPR 3)
 * канвас рисовался в CSS-пикселях и браузер растягивал его втрое — арт мылился
 * и шёл крупными пикселями. Выше 2 не поднимаем: при DPR 3 заливки в 9 раз
 * больше, и дешёвые Android не тянут.
 */
const MAX_DENSITY = 2;

/**
 * Потолок можно поднять параметром `?density=` — только для съёмки скриншотов
 * и роликов карточки (scripts/catalog-shots.js, scripts/record-video.js):
 * кадр телефона 1080 × 1920 иначе рисуется в 810 × 1440 и растягивается.
 */
function maxDensity(): number {
  const asked = Number(new URLSearchParams(window.location.search).get('density'));
  return Number.isFinite(asked) && asked > 0 ? asked : MAX_DENSITY;
}

function density(): number {
  return Math.min(maxDensity(), Math.max(1, window.devicePixelRatio || 1));
}

/**
 * Единственное место, где создаётся игра Phaser.
 *
 * Канвас прозрачный и лежит нижним слоем: весь интерфейс рисует React поверх.
 * Размер задаёт контейнер-родитель, Phaser под него подстраивается.
 */
export interface GameHandle {
  readonly game: Phaser.Game;
  destroy(): void;
}

export function createGame(
  parent: HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[],
): GameHandle {
  const scaleDensity = density();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    banner: false,
    // Спрайты пиксельные: сглаживание превратило бы их в кашу.
    pixelArt: true,
    // Звуком заведует shared/audio. Свой звук Phaser поднимает при создании
    // игры — то есть до первого касания, — и браузер ругается в консоль на
    // каждом запуске.
    audio: { noAudio: true },
    // Размером управляем сами: Phaser измеряет родителя в момент создания, а
    // на первом кадре React-контейнер ещё нулевой, и канвас выходит за него.
    // Канвас — в физических пикселях, а на странице — в CSS (zoom = 1 / DPR).
    // Сцена считает в CSS-пикселях: её камера увеличена на ту же плотность
    // (см. BoardScene), так что раскладка и интерфейс поверх не меняются.
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, Math.round(parent.clientWidth * scaleDensity)),
      height: Math.max(1, Math.round(parent.clientHeight * scaleDensity)),
      zoom: 1 / scaleDensity,
    },
    scene: scenes,
  });

  // Потеря контекста WebGL случается на дешёвых Android при сворачивании.
  // Без preventDefault браузер не станет его восстанавливать вовсе.
  const canvas = game.canvas;
  const onLost = (event: Event): void => {
    event.preventDefault();
  };
  canvas?.addEventListener('webglcontextlost', onLost, false);

  const observer = new ResizeObserver(([entry]) => {
    if (entry === undefined) return;
    const { width, height } = entry.contentRect;
    // Плотность могла смениться: окно перетащили на другой монитор.
    const next = density();
    if (Math.abs(game.scale.zoom - 1 / next) > 1e-6) game.scale.setZoom(1 / next);
    if (width > 0 && height > 0)
      game.scale.resize(Math.round(width * next), Math.round(height * next));
  });
  observer.observe(parent);

  return {
    game,
    destroy(): void {
      observer.disconnect();
      canvas?.removeEventListener('webglcontextlost', onLost);
      game.destroy(true);
    },
  };
}
