/**
 * Stock Validation Unit Tests
 * Domain: src/lib/domain/stockValidation.ts
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
    checkStock,
    formatStockErrors,
} from '@/lib/domain/stockValidation';

type AggregateResult = { _sum: { quantity: number | null } };

/** Partial Prisma-style tx used by `checkStock` — only mocked delegates */
type StockCheckTxMock = {
    inventory: {
        aggregate: jest.MockedFunction<(args?: unknown) => Promise<AggregateResult>>;
        findUnique: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
        update: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
        create: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
    };
    product: {
        findUnique: jest.MockedFunction<
            (args?: unknown) => Promise<{ name: string } | null>
        >;
    };
    warehouse: {
        findMany: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
        findFirst: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
    };
    stockMovement: {
        create: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
    };
    orderItem: {
        findMany: jest.MockedFunction<(args?: unknown) => Promise<unknown>>;
    };
};

describe('stockValidation', () => {
    let mockTx: StockCheckTxMock;

    beforeEach(() => {
        mockTx = {
            inventory: {
                aggregate: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
                create: jest.fn(),
            },
            product: {
                findUnique: jest.fn(),
            },
            warehouse: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            stockMovement: {
                create: jest.fn(),
            },
            orderItem: {
                findMany: jest.fn(),
            },
        };
    });

    describe('checkStock', () => {
        it('yetarli inventar mavjud — ok true qaytaradi', async () => {
            mockTx.inventory.aggregate.mockResolvedValue({
                _sum: { quantity: 150 },
            });

            const result = await checkStock(mockTx, [
                { productId: 1, quantity: 120 },
            ]);

            expect(result.ok).toBe(true);
        });

        it('inventar yetarli emas — ok false qaytaradi', async () => {
            mockTx.inventory.aggregate.mockResolvedValue({
                _sum: { quantity: 50 },
            });
            mockTx.product.findUnique.mockResolvedValue({
                name: 'Test Product',
            });

            const result = await checkStock(mockTx, [
                { productId: 1, quantity: 120 },
            ]);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0].available).toBe(50);
                expect(result.errors[0].productName).toBe('Test Product');
            }
        });

        it('empty items array returns ok', async () => {
            const result = await checkStock(mockTx, []);
            expect(result.ok).toBe(true);
        });

        it('handles null inventory sum (no records)', async () => {
            mockTx.inventory.aggregate.mockResolvedValue({
                _sum: { quantity: null },
            });
            mockTx.product.findUnique.mockResolvedValue({
                name: 'Empty Product',
            });

            const result = await checkStock(mockTx, [
                { productId: 5, quantity: 1 },
            ]);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.errors[0].available).toBe(0);
            }
        });

        it('handles multiple products — partial failure', async () => {
            mockTx.inventory.aggregate
                .mockResolvedValueOnce({ _sum: { quantity: 100 } })
                .mockResolvedValueOnce({ _sum: { quantity: 2 } });
            mockTx.product.findUnique.mockResolvedValue({
                name: 'Insufficient Product',
            });

            const result = await checkStock(mockTx, [
                { productId: 1, quantity: 50 },  // enough
                { productId: 2, quantity: 10 },  // not enough
            ]);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.errors).toHaveLength(1);
                expect(result.errors[0].productId).toBe(2);
            }
        });

        it('falls back to ID:N when product not found', async () => {
            mockTx.inventory.aggregate.mockResolvedValue({
                _sum: { quantity: 0 },
            });
            mockTx.product.findUnique.mockResolvedValue(null);

            const result = await checkStock(mockTx, [
                { productId: 99, quantity: 5 },
            ]);

            expect(result.ok).toBe(false);
            if (!result.ok) {
                expect(result.errors[0].productName).toBe('ID:99');
            }
        });
    });

    describe('formatStockErrors', () => {
        it('xatoliklarni to\'g\'ri formatlaydi', () => {
            const errors = [
                {
                    productId: 1,
                    productName: 'Box A',
                    requested: 10,
                    available: 4,
                },
            ];
            const formatted = formatStockErrors(errors);
            expect(formatted).toContain('"Box A" — omborda 4 ta bor, 10 ta so\'ralgan');
        });

        it('formats multiple errors with semicolon separator', () => {
            const errors = [
                { productId: 1, productName: 'A', requested: 10, available: 3 },
                { productId: 2, productName: 'B', requested: 5, available: 0 },
            ];
            const result = formatStockErrors(errors);
            expect(result.split('; ')).toHaveLength(2);
        });

        it('returns empty string for empty array', () => {
            expect(formatStockErrors([])).toBe('');
        });
    });
});

