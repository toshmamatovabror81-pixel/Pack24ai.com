import type { Section } from '@/lib/auth/permissions';

export const adminNav: { href: string; label: string; section: Section; icon: string }[] = [
  { href: '/admin', label: 'Boshqaruv paneli', section: 'dashboard', icon: 'LayoutDashboard' },
  { href: '/admin/orders', label: 'Buyurtmalar', section: 'orders', icon: 'ShoppingCart' },
  { href: '/admin/leads', label: 'Arizalar', section: 'leads', icon: 'Inbox' },
  { href: '/admin/products', label: 'Mahsulotlar', section: 'products', icon: 'Package' },
  { href: '/admin/categories', label: 'Kategoriyalar', section: 'products', icon: 'FolderTree' },
  { href: '/admin/customers', label: 'Mijozlar', section: 'customers', icon: 'Users' },
  { href: '/admin/production', label: 'Ishlab chiqarish', section: 'production', icon: 'Factory' },
  { href: '/admin/contracts', label: 'Shartnomalar', section: 'finance', icon: 'FileSignature' },
  { href: '/admin/invoices', label: 'Hisob-fakturalar', section: 'finance', icon: 'Receipt' },
  { href: '/admin/inventory', label: 'Ombor', section: 'inventory', icon: 'Warehouse' },
  { href: '/admin/promo', label: 'Promokodlar', section: 'marketing', icon: 'BadgePercent' },
  { href: '/admin/banners', label: 'Bannerlar', section: 'marketing', icon: 'Image' },
  { href: '/admin/reviews', label: 'Sharhlar', section: 'marketing', icon: 'Star' },
  { href: '/admin/posts', label: 'Blog', section: 'content', icon: 'Newspaper' },
  { href: '/admin/faq', label: 'Savol-javob', section: 'content', icon: 'HelpCircle' },
  { href: '/admin/reports', label: 'Hisobotlar', section: 'reports', icon: 'BarChart3' },
  { href: '/admin/staff', label: 'Xodimlar', section: 'staff', icon: 'UserCog' },
  { href: '/admin/settings', label: 'Sozlamalar', section: 'settings', icon: 'Settings' },
];
