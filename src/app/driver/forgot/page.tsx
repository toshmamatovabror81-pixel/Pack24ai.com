import Link from 'next/link';
import { Logo } from '@/components/site/Logo';

export const metadata = { title: 'Parolni tiklash' };

export default function DriverForgotPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <Logo className="text-brand-700" />
          <p className="mt-1 text-sm text-slate-500">Parolni tiklash</p>
        </div>
        <p className="text-sm text-slate-700">Parol faqat <b>Haydovchi boti</b> orqali tiklanadi — shunda telefon raqamingiz sizniki ekani tasdiqlanadi.</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
          <li>Telegram'da Haydovchi botini oching (havolani masulingiz beradi).</li>
          <li>Botga <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">/password</code> buyrug'ini yuboring.</li>
          <li>Bot yangi parolni yuboradi — shu parol bilan kiring.</li>
        </ol>
        <p className="text-xs text-slate-500">Telegram botga hali bog'lanmagan bo'lsangiz, masulingizdan ro'yxatdan o'tish kodini so'rang.</p>
        <Link href="/driver/login" className="btn-ghost w-full py-3">← Kirish sahifasi</Link>
      </div>
    </div>
  );
}
