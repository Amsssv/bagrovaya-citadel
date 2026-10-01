// Разрешённый импорт: домен идёт вниз, в shared/lib. Ошибок быть не должно —
// иначе правила слишком строгие и мешают работать.
import { createRng } from '@/shared/lib/rng';

export const legal = createRng(1).next();
