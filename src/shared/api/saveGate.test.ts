import { describe, expect, it, vi } from 'vitest';

import { createSaveGate } from './saveGate';

describe('ограничитель записи', () => {
  it('первая запись проходит сразу', () => {
    const write = vi.fn();
    expect(createSaveGate(write, 10_000).request('раз', 0)).toBe(true);
    expect(write).toHaveBeenCalledWith('раз');
  });

  it('вторая запись раньше срока не проходит', () => {
    const write = vi.fn();
    const gate = createSaveGate(write, 10_000);
    gate.request('раз', 0);
    expect(gate.request('два', 5_000)).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('после срока проходит снова — и записывается последнее', () => {
    const write = vi.fn();
    const gate = createSaveGate(write, 10_000);
    gate.request('раз', 0);
    gate.request('два', 5_000);
    expect(gate.request('три', 10_000)).toBe(true);
    expect(write).toHaveBeenLastCalledWith('три');
  });

  it('одно и то же значение второй раз не пишем', () => {
    const write = vi.fn();
    const gate = createSaveGate(write, 10_000);
    gate.request('раз', 0);
    expect(gate.request('раз', 30_000)).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe('несохранённое', () => {
  it('отложенная запись помечена как несохранённая', () => {
    const gate = createSaveGate(vi.fn(), 10_000);
    gate.request('раз', 0);
    gate.request('два', 100);
    expect(gate.pending).toBe(true);
  });

  it('flush сбрасывает её немедленно, не глядя на срок', () => {
    const write = vi.fn();
    const gate = createSaveGate(write, 10_000);
    gate.request('раз', 0);
    gate.request('два', 100);

    expect(gate.flush(200)).toBe(true);
    expect(write).toHaveBeenLastCalledWith('два');
    expect(gate.pending).toBe(false);
  });

  it('flush без несохранённого ничего не делает', () => {
    const write = vi.fn();
    const gate = createSaveGate(write, 10_000);
    gate.request('раз', 0);
    expect(gate.flush(100)).toBe(false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('после сброса срок отсчитывается заново', () => {
    const write = vi.fn();
    const gate = createSaveGate(write, 10_000);
    gate.request('раз', 0);
    gate.request('два', 100);
    gate.flush(200);
    expect(gate.request('три', 5_000)).toBe(false);
    expect(gate.request('три', 10_200)).toBe(true);
  });
});
