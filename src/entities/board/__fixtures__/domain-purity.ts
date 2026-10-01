// Нарочно сломанный файл. Каждая строка обязана быть поймана линтером;
// проверяется в tests/eslint-rules.test.ts.
import { useState } from 'react';
import Phaser from 'phaser';
import { create } from 'zustand';

import { target } from '@/shared/ui/__fixtures__/target';

export function broken() {
  const saved = localStorage.getItem('board');
  const width = window.innerWidth;
  document.title = 'нет';
  return [Math.random(), useState, Phaser, create, target, saved, width];
}
