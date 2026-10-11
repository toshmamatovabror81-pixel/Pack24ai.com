import 'server-only';
import uz, { type Dict } from './dict/uz';
import ru from './dict/ru';
import en from './dict/en';
import type { Locale } from './config';

const dicts: Record<Locale, Dict> = { uz, ru, en };

export function getDict(locale: Locale): Dict {
  return dicts[locale] ?? uz;
}

export type { Dict };
