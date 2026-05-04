/** @jest-environment node */

import {
    buildBotEventFeedApiQuery,
    buildPathWithBeBotEventFilters,
    buildPathWithRecyclingTab,
    readBotEventFeedFiltersFromUrl,
    removeBotEventFeedParamsFromSearchString,
    urlHasBotEventFeedParams,
} from '@/lib/platform/botEventFeedUrl';

describe('botEventFeedUrl', () => {
    it('urlHasBotEventFeedParams: be kalit bo‘lsa true', () => {
        expect(urlHasBotEventFeedParams(new URLSearchParams('tab=dashboard'))).toBe(false);
        expect(urlHasBotEventFeedParams(new URLSearchParams('besourceBot=driver'))).toBe(true);
    });

    it('removeBotEventFeedParamsFromSearchString: be* olib tashlanadi, qolganlar qoladi', () => {
        const out = removeBotEventFeedParamsFromSearchString(
            'tab=requests&requestId=1&besourceBot=platform&beq=hi',
        );
        const p = new URLSearchParams(out);
        expect(p.get('tab')).toBe('requests');
        expect(p.get('requestId')).toBe('1');
        expect(p.get('besourceBot')).toBeNull();
    });

    it('buildPathWithRecyclingTab: jurnal, be* olib requestId saqlanadi', () => {
        const path = buildPathWithRecyclingTab(
            '/admin/recycling',
            'requestId=9&besourceBot=platform&tab=bot-events',
            { tab: 'journal', pointId: '3', supervisorId: '' },
        );
        const p = new URLSearchParams(path.split('?')[1] ?? '');
        expect(p.get('tab')).toBe('journal');
        expect(p.get('pointId')).toBe('3');
        expect(p.get('requestId')).toBe('9');
        expect(p.get('besourceBot')).toBeNull();
    });

    it('recyclingTab: bot-events joriy queryga qo‘shiladi', () => {
        const path = buildPathWithBeBotEventFilters(
            '/admin/recycling',
            'requestId=5',
            readBotEventFeedFiltersFromUrl(new URLSearchParams('')),
            { recyclingTab: 'bot-events' },
        );
        expect(path).toContain('tab=bot-events');
        expect(path).toContain('requestId=5');
    });

    it('sahifa query bilan merge qiladi va boshqa paramlarni saqlaydi', () => {
        const filters = readBotEventFeedFiltersFromUrl(
            new URLSearchParams('tab=requests&requestId=9&besourceBot=driver&q_old=1'),
        );
        const path = buildPathWithBeBotEventFilters(
            '/admin/recycling',
            'tab=requests&requestId=9&besourceBot=driver&legacy=1',
            { ...filters, eventType: 'order.created' },
        );
        expect(path).toContain('tab=requests');
        expect(path).toContain('requestId=9');
        expect(path).toContain('legacy=1');
        expect(path).toContain('be');
        expect(path).toContain('order.created');
    });

    it('URL va API query roundtrip: be + API nomi bilan', () => {
        const original = {
            sourceBot: 'all',
            eventType: 'recycling.request.status_changed',
            entityType: 'recycle_request',
            entityId: '12',
            fromDate: '',
            toDate: '',
            severity: 'all',
            status: 'unread',
            search: 'foo bar',
        };

        const path = buildPathWithBeBotEventFilters('/x', 'tab=bot', original);
        const fromUrl = readBotEventFeedFiltersFromUrl(new URLSearchParams(path.split('?')[1] ?? ''));
        expect(fromUrl).toEqual(original);

        const api = buildBotEventFeedApiQuery(fromUrl);
        expect(api.get('eventType')).toBe(original.eventType);
        expect(api.get('entityType')).toBe(original.entityType);
        expect(api.get('entityId')).toBe(original.entityId);
        expect(api.get('status')).toBe(original.status);
        expect(api.get('q')).toBe(original.search.trim());
    });
});
