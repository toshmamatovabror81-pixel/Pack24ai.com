import 'server-only';
import { prisma } from '@/lib/db';

/** RecyclingNav hisoblagichlari: yangi arizalar, faol shikoyatlar, yangi hodisalar, kutilayotgan kirish so'rovlari */
export async function recyclingNavBadges(): Promise<Record<string, number>> {
  try {
    const [requests, complaints, events, access] = await Promise.all([
      prisma.recycleRequest.count({ where: { status: 'new_' } }),
      prisma.recycleComplaint.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      prisma.botEvent.count({ where: { status: 'new_' } }),
      prisma.botAccessRequest.count({ where: { status: 'pending' } }),
    ]);
    return { '/admin/recycling': requests, '/admin/recycling/complaints': complaints, '/admin/recycling/events': events, '/admin/recycling/access': access };
  } catch {
    return {};
  }
}
