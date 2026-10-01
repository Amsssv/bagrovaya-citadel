import { describe, expect, it } from 'vitest';

import { EMPTY_SAVE } from './save';
import { chooseSave } from './sync';

const at = (savedAt: number) => ({ ...EMPTY_SAVE, savedAt });

describe('какой сейв брать', () => {
  it('облако новее, а здесь ещё не играли — берём облако', () => {
    expect(chooseSave(at(100), at(200), false)).toBe('cloud');
  });

  it('облако старше или такое же — местный', () => {
    expect(chooseSave(at(200), at(100), false)).toBe('local');
    expect(chooseSave(at(200), at(200), false)).toBe('local');
  });

  it('здесь уже сыграли — местный, даже если облако новее', () => {
    expect(chooseSave(at(100), at(200), true)).toBe('local');
  });

  it('в облаке пусто — местный', () => {
    expect(chooseSave(at(100), null, false)).toBe('local');
  });

  it('старый сейв без отметки времени проигрывает любому облачному', () => {
    expect(chooseSave(EMPTY_SAVE, at(1), false)).toBe('cloud');
  });
});
