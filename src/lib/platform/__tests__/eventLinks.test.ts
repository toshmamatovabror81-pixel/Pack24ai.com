/** @jest-environment node */

import {
    getAdminCollectionHref,
    getAdminDriverHref,
    getAdminEventHref,
    getAdminPointHref,
    getAdminRequestHref,
    getAdminSupervisorHref,
} from '@/lib/platform/eventLinks';

describe('getAdminEventHref', () => {
    it('order entity uchun orders sahifasiga link qaytaradi', () => {
        expect(getAdminEventHref({
            entityType: 'order',
            entityId: 12,
        })).toBe('/admin/orders?search=12');
    });

    it('recycle_request entity uchun requests tabiga link qaytaradi', () => {
        expect(getAdminEventHref({
            entityType: 'recycle_request',
            entityId: 44,
        })).toBe('/admin/recycling?tab=requests&requestId=44');
    });

    it('request helper request sahifasiga link qaytaradi', () => {
        expect(getAdminRequestHref(44)).toBe('/admin/recycling?tab=requests&requestId=44');
    });

    it('request helper ixtiyoriy requestStatus parametrini qo‘shadi', () => {
        expect(getAdminRequestHref(44, { requestStatus: 'completed' })).toBe(
            '/admin/recycling?tab=requests&requestId=44&requestStatus=completed',
        );
    });

    it('recycle_request event requestStatus bilan URL yig‘adi', () => {
        expect(
            getAdminEventHref({
                entityType: 'recycle_request',
                entityId: 44,
                requestStatus: 'open',
            }),
        ).toBe('/admin/recycling?tab=requests&requestId=44&requestStatus=open');
    });

    it('recycle_collection event requestId va requestStatus bilan', () => {
        expect(
            getAdminEventHref({
                entityType: 'recycle_collection',
                entityId: 30,
                requestId: 11,
                requestStatus: 'in_progress',
            }),
        ).toBe('/admin/recycling?tab=requests&requestId=11&requestStatus=in_progress');
    });

    it('recycle_collection event requestId bo\'lsa request sahifasiga olib boradi', () => {
        expect(getAdminEventHref({
            entityType: 'recycle_collection',
            entityId: 30,
            requestId: 11,
        })).toBe('/admin/recycling?tab=requests&requestId=11');
    });

    it('collection helper collections tabiga link qaytaradi', () => {
        expect(getAdminCollectionHref(30)).toBe('/admin/recycling?tab=collections&collectionId=30');
    });

    it('supervisor helper supervisors tabiga link qaytaradi', () => {
        expect(getAdminSupervisorHref(8)).toBe('/admin/recycling?tab=supervisors&supervisorId=8');
    });

    it('driver helper drivers tabiga link qaytaradi', () => {
        expect(getAdminDriverHref(6)).toBe('/admin/recycling?tab=drivers&driverId=6');
    });

    it('point helper points tabiga link qaytaradi', () => {
        expect(getAdminPointHref(3)).toBe('/admin/recycling?tab=points&pointId=3');
    });

    it('inventory entity uchun warehouse sahifasiga link qaytaradi', () => {
        expect(getAdminEventHref({
            entityType: 'inventory',
        })).toBe('/admin/products/warehouse');
    });

    it('journal eventType oylik jurnal tabiga', () => {
        expect(getAdminEventHref({
            eventType: 'journal.intake.created',
            pointId: 5,
            supervisorId: 2,
        })).toBe('/admin/recycling?tab=journal&pointId=5&supervisorId=2');
    });

    it('recycle_press_log entity jurnal tabiga (pointId)', () => {
        expect(getAdminEventHref({
            entityType: 'recycle_press_log',
            entityId: 7,
            pointId: 3,
        })).toBe('/admin/recycling?tab=journal&pointId=3');
    });

    it('shikoyat event complaints tabiga', () => {
        expect(getAdminEventHref({
            eventType: 'complaint.created',
            entityType: 'recycle_complaint',
            entityId: 1,
            requestId: 10,
            pointId: 2,
        })).toBe('/admin/recycling?tab=complaints&requestId=10&pointId=2');
    });

    it('driver fallback bo\'lsa driver linkini qaytaradi', () => {
        expect(getAdminEventHref({
            driverId: 6,
        })).toBe('/admin/recycling?tab=drivers&driverId=6');
    });

    it('hech qanday mos entity bo\'lmasa null qaytaradi', () => {
        expect(getAdminEventHref({
            entityType: 'unknown',
        })).toBeNull();
    });
});
