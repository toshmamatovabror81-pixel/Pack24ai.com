import Link from 'next/link';
import { requireStaff } from '@/lib/auth';
import { can, roleNames } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { adminNav } from '@/components/admin/nav';
import { Sidebar } from '@/components/admin/Sidebar';
import { adminLogout } from './actions';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const items = adminNav.filter((i) => can(user.role, i.section));
  const [newOrders, newLeads, pendingReviews, newRecycling, pendingAccess] = await Promise.all([
    prisma.order.count({ where: { status: 'new_', deletedAt: null } }),
    prisma.lead.count({ where: { status: 'new_' } }),
    can(user.role, 'marketing') ? prisma.review.count({ where: { status: 'pending' } }) : 0,
    can(user.role, 'recycling') ? prisma.recycleRequest.count({ where: { status: 'new_' } }) : 0,
    can(user.role, 'recycling') ? prisma.botAccessRequest.count({ where: { status: 'pending' } }) : 0,
  ]);
  return (
    <div className="min-h-screen">
      <Sidebar items={items} badges={{ '/admin/orders': newOrders, '/admin/leads': newLeads, '/admin/reviews': pendingReviews, '/admin/recycling': newRecycling + pendingAccess }} />
      <div className="lg:pl-60">
        <header className="flex h-14 items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 text-sm">
          <Link href="/uz" target="_blank" className="text-brand-500 hover:underline">Saytni ochish ↗</Link>
          <span className="text-slate-600">{user.name} · {roleNames[user.role]}</span>
          <form action={adminLogout}><button className="text-slate-500 hover:text-accent-500">Chiqish</button></form>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
