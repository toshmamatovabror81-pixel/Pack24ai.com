import '@testing-library/jest-dom';
import { stopAutoPersist } from '@/lib/telegram/sessionStore';
import { eventBus } from '@/lib/platform/eventBus';

afterAll(async () => {
    stopAutoPersist();
    eventBus.shutdown();

    const g = globalThis as { prisma?: { $disconnect?: () => Promise<void> } };
    await g.prisma?.$disconnect?.();
});
