import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Шрифты едут в сборке, а не с чужого сервера: игра обязана работать без сети,
// а площадка может резать внешние запросы.
import '@fontsource/cormorant-sc/600.css';
import '@fontsource/cormorant-sc/700.css';
import '@fontsource-variable/manrope';

import { createPlatform } from '@/shared/api';

import { App } from './App';
import { applyLang, detectLang } from './lang';
import { installErrorLog } from './errorLog';
import { installPageGuards } from './pageGuards';
import './global.scss';

// Журнал ошибок — первым: упасть может уже подъём площадки.
installErrorLog();
installPageGuards();

const root = document.getElementById('root');
if (!root) throw new Error('Не найден #root');

// Язык определяется по SDK (п. 2.14 требований площадки), и сделать это надо
// до первого кадра интерфейса: поэтому площадка поднимается здесь, а не в App.
const platform = createPlatform();
applyLang(await detectLang(platform));

createRoot(root).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
);
