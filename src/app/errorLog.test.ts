import { describe, expect, it } from 'vitest';

import { createErrorLog, describeError, installErrorLog } from './errorLog';

describe('журнал ошибок', () => {
  it('пишет в консоль с меткой игры и местом', () => {
    const lines: string[] = [];
    const log = createErrorLog((line) => lines.push(line));
    log.record('TypeError: x', 'app.js:10');
    log.record('без места', '');
    expect(lines).toEqual([
      '[Багровая Цитадель] TypeError: x (app.js:10)',
      '[Багровая Цитадель] без места',
    ]);
  });

  it('повтор — не новая строка, а счётчик', () => {
    const lines: string[] = [];
    const log = createErrorLog((line) => lines.push(line));
    log.record('каждый кадр', 'scene');
    log.record('каждый кадр', 'scene');
    expect(lines).toHaveLength(1);
    expect(log.records[0]?.count).toBe(2);
  });

  it('держит только последние двадцать', () => {
    const log = createErrorLog(() => undefined);
    for (let i = 0; i < 25; i++) log.record(`ошибка ${String(i)}`, '');
    expect(log.records).toHaveLength(20);
    expect(log.records[0]?.message).toBe('ошибка 5');
  });

  it('текст — из чего угодно', () => {
    expect(describeError(new RangeError('далеко'))).toBe('RangeError: далеко');
    expect(describeError('строка')).toBe('строка');
    expect(describeError({ code: 7 })).toBe('{"code":7}');
    expect(describeError(undefined)).toBe('undefined');
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(describeError(loop)).toBe('[object Object]');
  });

  it('ловит ошибки окна и отклонённые промисы', () => {
    const lines: string[] = [];
    const win = new EventTarget() as unknown as Window;
    const log = installErrorLog(win, (line) => lines.push(line));
    win.dispatchEvent(
      Object.assign(new Event('error'), { error: new Error('упало'), filename: 'a.js', lineno: 3 }),
    );
    win.dispatchEvent(Object.assign(new Event('error'), { message: 'скрипт', filename: '' }));
    win.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'нет сети' }));
    expect(log.records.map((item) => item.where)).toEqual(['a.js:3', '', 'promise']);
    expect((win as unknown as { __citadelErrors: unknown }).__citadelErrors).toBe(log.records);
  });
});
