import { describe, expect, it } from 'vitest';

import { installPageGuards } from './pageGuards';

/** Окно-подделка: хватает addEventListener, как у настоящего. */
function fakeWindow() {
  const doc = new EventTarget();
  const win = Object.assign(new EventTarget(), { document: doc });
  return { win: win as unknown as Window, doc, target: win };
}

const fire = (target: EventTarget, type: string, init: Record<string, unknown> = {}): boolean => {
  const event = Object.assign(new Event(type, { cancelable: true }), init);
  target.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('страница — как игра', () => {
  it('контекстное меню, жест зума iOS и выделение гасятся', () => {
    const { win, doc } = fakeWindow();
    installPageGuards(win);
    expect(fire(doc, 'contextmenu')).toBe(true);
    expect(fire(doc, 'gesturestart')).toBe(true);
    expect(fire(doc, 'selectstart')).toBe(true);
  });

  it('Ctrl + колесо и Ctrl + «+» не масштабируют, обычные колесо и клавиши — работают', () => {
    const { win, target } = fakeWindow();
    installPageGuards(win);
    expect(fire(target, 'wheel', { ctrlKey: true })).toBe(true);
    expect(fire(target, 'wheel', { ctrlKey: false })).toBe(false);
    expect(fire(target, 'keydown', { ctrlKey: true, key: '+' })).toBe(true);
    expect(fire(target, 'keydown', { metaKey: true, key: '0' })).toBe(true);
    expect(fire(target, 'keydown', { ctrlKey: true, key: 'c' })).toBe(false);
    expect(fire(target, 'keydown', { key: '+' })).toBe(false);
  });

  it('отписка снимает всё', () => {
    const { win, doc, target } = fakeWindow();
    installPageGuards(win)();
    expect(fire(doc, 'contextmenu')).toBe(false);
    expect(fire(target, 'wheel', { ctrlKey: true })).toBe(false);
  });
});
