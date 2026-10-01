import type { NightEvent } from '@/entities/wave';
import type { Position } from '@/shared/lib/geometry';

/**
 * Перевод лога боя в подсказки для сцены.
 *
 * Домен считает Рассвет целиком и мгновенно; сцена потом проигрывает лог со
 * своей скоростью. Здесь — тонкая прослойка между ними, и она чистая: ни одного
 * обращения к Phaser, поэтому проверяется тестами наравне с доменом.
 *
 * Цифры урона и смерти привязаны к охотнику, а не к клетке: спрайт на экране
 * едет плавно и в момент попадания находится между рядами.
 */
export type BattleCue =
  | {
      readonly type: 'spawn';
      readonly at: number;
      readonly id: string;
      readonly kind: string;
      readonly column: number;
      readonly row: number;
      /** Босс — с полоской жизней внизу; `hp` — сколько у него жизней. */
      readonly boss: boolean;
      readonly hp: number;
    }
  | {
      readonly type: 'march';
      readonly at: number;
      readonly id: string;
      /** Дробный ряд, куда спрайт придёт к концу шага: там охотник и будет. */
      readonly y: number;
      readonly duration: number;
    }
  /** Враг в тумане или вышел из него: сцена красит его и сбавляет шаг. */
  | { readonly type: 'pace'; readonly at: number; readonly id: string; readonly slowed: boolean }
  | {
      readonly type: 'shot';
      readonly at: number;
      readonly from: Position;
      readonly targets: readonly string[];
      readonly damage: number;
    }
  | {
      readonly type: 'damage';
      readonly at: number;
      readonly id: string;
      readonly amount: number;
      /** Сколько жизней осталось после попадания. */
      readonly hpLeft: number;
      /** Откуда стреляли; нет — вспышка без своего вида. */
      readonly from?: Position;
    }
  | { readonly type: 'death'; readonly at: number; readonly id: string }
  | {
      readonly type: 'leak';
      readonly at: number;
      readonly id: string;
      readonly damage: number;
      /** Сколько сердец у цитадели после удара — счётчик в шапке идёт вживую. */
      readonly heartsLeft: number;
    }
  | { readonly type: 'end'; readonly at: number };

/**
 * Следующее событие охотника, где известна его точная координата: переход в
 * другой ряд, вход в туман и выход из него, гибель или ворота.
 */
function nextMomentFor(
  events: readonly NightEvent[],
  id: string,
  after: number,
): { readonly at: number; readonly y: number } | null {
  for (const event of events) {
    if (event.at <= after) continue;
    if (
      event.type !== 'move' &&
      event.type !== 'pace' &&
      event.type !== 'kill' &&
      event.type !== 'leak'
    ) {
      continue;
    }
    if (event.id === id) return { at: event.at, y: event.y };
  }
  return null;
}

/**
 * Шаг от этого момента до следующего события охотника.
 *
 * Между событиями охотник идёт с постоянной скоростью: скорость меняет только
 * туман, а вход в его полосу и выход из неё — тоже события. Поэтому спрайт
 * ведётся линейно к **точной** координате следующего события, и в тумане он
 * замедляется ровно там, где туман есть.
 *
 * Раньше шаг вёл в центр следующей клетки за время до любого следующего
 * события. Погибший через миг после входа в клетку проскакивал её целиком —
 * со стороны это выглядело как прыжок через постройку.
 */
function marchFrom(events: readonly NightEvent[], id: string, at: number): BattleCue | null {
  const next = nextMomentFor(events, id, at);
  if (next === null) return null;
  return { type: 'march', at, id, y: next.y, duration: next.at - at };
}

export function buildCues(events: readonly NightEvent[], boardHeight: number): BattleCue[] {
  const cues: BattleCue[] = [];
  const pushMarch = (id: string, at: number): void => {
    const march = marchFrom(events, id, at);
    if (march !== null) cues.push(march);
  };

  for (const event of events) {
    switch (event.type) {
      case 'spawn':
        cues.push({
          type: 'spawn',
          at: event.at,
          id: event.id,
          kind: event.kind,
          column: event.column,
          row: event.y ?? boardHeight - 1,
          boss: event.boss === true,
          hp: event.hp ?? 0,
        });
        pushMarch(event.id, event.at);
        break;

      case 'move':
        pushMarch(event.id, event.at);
        break;

      case 'pace':
        cues.push({ type: 'pace', at: event.at, id: event.id, slowed: event.factor < 1 });
        pushMarch(event.id, event.at);
        break;

      case 'shot':
        cues.push({
          type: 'shot',
          at: event.at,
          from: event.from,
          targets: event.targets,
          damage: event.damage,
        });
        break;

      case 'hit':
        cues.push({
          type: 'damage',
          at: event.at,
          id: event.id,
          amount: event.amount,
          hpLeft: event.hpLeft,
          ...(event.from !== undefined && { from: event.from }),
        });
        break;

      case 'kill':
        cues.push({ type: 'death', at: event.at, id: event.id });
        break;

      case 'leak':
        cues.push({
          type: 'leak',
          at: event.at,
          id: event.id,
          damage: event.damage,
          heartsLeft: event.heartsLeft,
        });
        break;

      case 'end':
        cues.push({ type: 'end', at: event.at });
        break;
    }
  }

  return cues;
}

/** Сколько всего продлится показ боя на этой скорости. */
export function battleDuration(cues: readonly BattleCue[], speed: number): number {
  return (cues.at(-1)?.at ?? 0) / speed;
}

/** Сколько длится покраснение от попадания: в оригинале — 10 тиков при 60 в секунду. */
export const HIT_FLASH_MS = 167;

/**
 * Оттенок врага во время покраснения, `progress` — от 0 до 1. Как в оригинале:
 * зелёный и синий проседают по синусоиде до 144 из 255 на середине, красный
 * остаётся. Оттенок ложится поверх своего цвета врага — у заглушки он не белый.
 */
export function hitFlashTint(progress: number, base = 0xffffff): number {
  const t = Math.min(1, Math.max(0, progress));
  const dip = (255 - 111 * Math.sin(t * Math.PI)) / 255;
  const r = (base >> 16) & 0xff;
  const g = Math.round(((base >> 8) & 0xff) * dip);
  const b = Math.round((base & 0xff) * dip);
  return (r << 16) | (g << 8) | b;
}
