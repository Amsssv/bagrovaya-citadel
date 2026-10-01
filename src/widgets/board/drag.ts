import type { Direction } from '@/shared/lib/geometry';

/**
 * Разбор жеста перетаскивания.
 *
 * Тянуть далеко не надо: свап — основное и самое частое действие, и если жест
 * требует точности, играть одной рукой в транспорте невозможно. Двенадцать
 * точек — компромисс: ниже случайное дрожание пальца превращается в ход, выше
 * жест начинает казаться тугим.
 */
export const DRAG_THRESHOLD_PX = 12;

export function dragDirection(
  start: { x: number; y: number },
  current: { x: number; y: number },
  threshold = DRAG_THRESHOLD_PX,
): Direction | null {
  const dx = current.x - start.x;
  const dy = current.y - start.y;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return null;

  // При равных смещениях побеждает горизонталь — лишь бы выбор был
  // определённым, а не зависел от порядка сравнения.
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}
