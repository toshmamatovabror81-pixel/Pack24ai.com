import type { OrderStatus, PaymentStatus } from '@prisma/client';

/** Prisma enum "new_" bazada "new" */
export const statusKey = (s: OrderStatus) => (s === 'new_' ? 'new' : s) as 'draft' | 'new' | 'processing' | 'shipping' | 'delivered' | 'cancelled';
export const paymentKey = (s: PaymentStatus) => s;
