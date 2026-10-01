import Phaser from 'phaser';

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
    scale: {
      mode: Phaser.Scale.NONE,
      width: Math.max(1, parent.clientWidth),
      height: Math.max(1, parent.clientHeight),
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
    if (width > 0 && height > 0) game.scale.resize(width, height);
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
