import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth';
import { can } from '@/lib/auth/permissions';
import { uploadImage } from '@/lib/storage';

const FOLDERS = ['products', 'categories', 'banners', 'blog'] as const;

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !(can(user.role, 'products') || can(user.role, 'marketing') || can(user.role, 'content'))) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }
  const fd = await req.formData();
  const file = fd.get('file');
  const folder = FOLDERS.find((f) => f === fd.get('folder')) ?? 'products';
  if (!(file instanceof File)) return NextResponse.json({ error: 'Fayl topilmadi' }, { status: 400 });
  try {
    return NextResponse.json({ url: await uploadImage(file, folder) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Xato' }, { status: 400 });
  }
}
