import Link from 'next/link';

/** /driver ichidagi 404: begona yoki mavjud bo'lmagan topshiriq ham shu yerga tushadi */
export default function DriverNotFound() {
  return (
    <div className="card p-6 text-center">
      <p className="text-5xl font-black text-brand-500">404</p>
      <h1 className="mt-3 text-lg font-bold">Sahifa topilmadi</h1>
      <p className="mt-1 text-sm text-slate-500">Bu topshiriq sizga tegishli emas yoki mavjud emas.</p>
      <Link href="/driver" className="btn-primary mt-5 inline-block">← Topshiriqlar</Link>
    </div>
  );
}
