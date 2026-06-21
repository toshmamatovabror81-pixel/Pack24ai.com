import {
    isValidUserRole,
    isValidCustomerType,
    isValidCustomerGroup,
    USER_ROLES,
    CUSTOMER_TYPES,
    CUSTOMER_GROUPS,
    ECO_LEVELS,
} from '@/lib/domain/userRoles';
import { isValidCampaignType, CAMPAIGN_TYPES } from '@/lib/domain/campaignTypes';

describe('userRoles domain', () => {
    describe('isValidUserRole', () => {
        it.each(USER_ROLES as unknown as string[])('"%s" ni qabul qiladi', (role) => {
            expect(isValidUserRole(role)).toBe(true);
        });

        it('noto\'g\'ri qiymatlarni rad etadi', () => {
            expect(isValidUserRole('superadmin')).toBe(false);
            expect(isValidUserRole('')).toBe(false);
            expect(isValidUserRole(null)).toBe(false);
            expect(isValidUserRole(undefined)).toBe(false);
            expect(isValidUserRole(42)).toBe(false);
        });
    });

    describe('isValidCustomerType', () => {
        it.each(CUSTOMER_TYPES as unknown as string[])('"%s" ni qabul qiladi', (type) => {
            expect(isValidCustomerType(type)).toBe(true);
        });

        it('noto\'g\'ri qiymatni rad etadi', () => {
            expect(isValidCustomerType('partner')).toBe(false);
        });
    });

    describe('isValidCustomerGroup', () => {
        it.each(CUSTOMER_GROUPS as unknown as string[])('"%s" ni qabul qiladi', (group) => {
            expect(isValidCustomerGroup(group)).toBe(true);
        });

        it('noto\'g\'ri qiymatni rad etadi', () => {
            expect(isValidCustomerGroup('gold')).toBe(false);
        });
    });

    describe('ECO_LEVELS', () => {
        it('7 ta darajani o\'z ichiga oladi', () => {
            expect(ECO_LEVELS.length).toBe(7);
            expect(ECO_LEVELS[0]).toBe('seed');
            expect(ECO_LEVELS[6]).toBe('legend');
        });
    });
});

describe('campaignTypes domain', () => {
    describe('isValidCampaignType', () => {
        it.each(CAMPAIGN_TYPES as unknown as string[])('"%s" ni qabul qiladi', (type) => {
            expect(isValidCampaignType(type)).toBe(true);
        });

        it('noto\'g\'ri qiymatni rad etadi', () => {
            expect(isValidCampaignType('push')).toBe(false);
            expect(isValidCampaignType('whatsapp')).toBe(false);
        });
    });
});
