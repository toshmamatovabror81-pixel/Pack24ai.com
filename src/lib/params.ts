export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export const parseSort = (v: string | undefined): 'new' | 'cheap' | 'expensive' => (v === 'cheap' || v === 'expensive' ? v : 'new');
