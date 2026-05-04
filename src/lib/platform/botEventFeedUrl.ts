/**
 * Bot Event Feed filter params are namespaced in the page URL with this prefix
 * so they do not clash with other recycling page query params (tab, requestId, …).
 * Keys are `be` + the exact /api/admin/bot-events query name (e.g. besourceBot, beq).
 */
const BE_PREFIX = 'be';

const BOT_EVENT_FEED_API_PARAM_KEYS = [
    'sourceBot',
    'eventType',
    'entityType',
    'entityId',
    'from',
    'to',
    'severity',
    'status',
    'q',
] as const;

export type BotEventFeedApiParamKey = (typeof BOT_EVENT_FEED_API_PARAM_KEYS)[number];

export type BotEventFeedFilterState = {
    sourceBot: string;
    eventType: string;
    entityType: string;
    entityId: string;
    fromDate: string;
    toDate: string;
    severity: string;
    status: string;
    search: string;
};

const DEFAULTS: BotEventFeedFilterState = {
    sourceBot: 'all',
    eventType: 'all',
    entityType: 'all',
    entityId: '',
    fromDate: '',
    toDate: '',
    severity: 'all',
    status: 'all',
    search: '',
};

function beKey(apiKey: BotEventFeedApiParamKey) {
    return `${BE_PREFIX}${apiKey}`;
}

function getBeParamString(params: Pick<URLSearchParams, 'get'>, apiKey: BotEventFeedApiParamKey) {
    return params.get(beKey(apiKey))?.trim() ?? '';
}

export function buildBotEventFeedApiQuery(filters: BotEventFeedFilterState) {
    const params = new URLSearchParams();
    if (filters.sourceBot !== 'all') params.set('sourceBot', filters.sourceBot);
    if (filters.eventType !== 'all') params.set('eventType', filters.eventType);
    if (filters.entityType !== 'all') params.set('entityType', filters.entityType);
    if (filters.entityId.trim()) params.set('entityId', filters.entityId.trim());
    if (filters.fromDate) params.set('from', filters.fromDate);
    if (filters.toDate) params.set('to', filters.toDate);
    if (filters.severity !== 'all') params.set('severity', filters.severity);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.search.trim()) params.set('q', filters.search.trim());
    return params;
}

function stripBeBotEventKeys(target: URLSearchParams) {
    for (const apiKey of BOT_EVENT_FEED_API_PARAM_KEYS) {
        target.delete(beKey(apiKey));
    }
}

/** Boshqa admin yorliqlariga o‘tganda `be*` query kalitlarini olib tashlash. `search` — `?`siz. */
export function removeBotEventFeedParamsFromSearchString(search: string): string {
    const q = search.startsWith('?') ? search.slice(1) : search;
    const next = new URLSearchParams(q);
    stripBeBotEventKeys(next);
    return next.toString();
}

/** Recycling sahifasida bot-event filterlari bormi (URLdagi `be*` + API nomi kalitlar). */
export function urlHasBotEventFeedParams(params: URLSearchParams | Pick<URLSearchParams, 'has' | 'get'>): boolean {
    for (const apiKey of BOT_EVENT_FEED_API_PARAM_KEYS) {
        if (params.has(beKey(apiKey))) {
            return true;
        }
    }
    return false;
}

/**
 * Read bot-event filter fields from a URL (only `be` + known API keys are used).
 */
export function readBotEventFeedFiltersFromUrl(
    params: URLSearchParams | Pick<URLSearchParams, 'get'>,
): BotEventFeedFilterState {
    return {
        sourceBot: getBeParamString(params, 'sourceBot') || 'all',
        eventType: getBeParamString(params, 'eventType') || 'all',
        entityType: getBeParamString(params, 'entityType') || 'all',
        entityId: getBeParamString(params, 'entityId'),
        fromDate: getBeParamString(params, 'from'),
        toDate: getBeParamString(params, 'to'),
        severity: getBeParamString(params, 'severity') || 'all',
        status: getBeParamString(params, 'status') || 'all',
        search: getBeParamString(params, 'q'),
    };
}

export type BuildPathWithBeBotEventFiltersOptions = {
    /** Recycling admin ichida to‘g‘ri yorliq: havola nusxalanganda / URL sinxroni uchun. */
    recyclingTab?: 'bot-events';
};

/**
 * Copy current `search` and overlay encoded bot-event filters, preserving non-bot query params.
 */
export function buildPathWithBeBotEventFilters(
    pathname: string,
    currentSearch: string,
    filters: BotEventFeedFilterState,
    options?: BuildPathWithBeBotEventFiltersOptions,
) {
    const next = new URLSearchParams(currentSearch);
    stripBeBotEventKeys(next);

    const api = buildBotEventFeedApiQuery(filters);
    for (const [key, value] of api.entries()) {
        next.set(beKey(key as BotEventFeedApiParamKey), value);
    }

    if (options?.recyclingTab) {
        next.set('tab', options.recyclingTab);
    }

    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}

export function createDefaultBotEventFeedFilterState(): BotEventFeedFilterState {
    return { ...DEFAULTS };
}

/**
 * Oylik jurnal (yoki boshqa yorliq) uchun `tab`, `pointId`, `supervisorId` — `be*` olib tashlanadi; `requestId` / `driverId` / boshqa kalitlarga tegmaymiz.
 */
export function buildPathWithRecyclingTab(
    pathname: string,
    currentSearch: string,
    options: { tab: string; pointId: string; supervisorId: string },
) {
    const raw = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
    const next = new URLSearchParams(removeBotEventFeedParamsFromSearchString(raw));
    next.set('tab', options.tab);
    if (options.pointId) next.set('pointId', options.pointId);
    else next.delete('pointId');
    if (options.supervisorId) next.set('supervisorId', options.supervisorId);
    else next.delete('supervisorId');
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
}
