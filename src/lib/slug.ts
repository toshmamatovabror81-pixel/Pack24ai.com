const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's',
  ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, '')
    .split('')
    .map((ch) => MAP[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Bazadagi Int ustunning yuqori chegarasi (Postgres INT4): kattaroq son so'rovda xato beradi, 404 o'rniga 500 chiqardi */
export const MAX_INT4 = 2_147_483_647;

/** "12-karton-quti" -> 12; raqam bo'lmasa yoki Int chegarasidan chiqsa null */
export function idFromParam(param: string | undefined | null): number | null {
  const m = /^(\d+)(?:-|$)/.exec(param ?? '');
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id > 0 && id <= MAX_INT4 ? id : null;
}
