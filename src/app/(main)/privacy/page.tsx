import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Maxfiylik siyosati',
    description: "Pack24 (pack24.uz) foydalanuvchilarning shaxsiy ma'lumotlarini qanday yig'adi, saqlaydi va himoya qiladi.",
    alternates: { canonical: '/privacy' },
};

const SECTIONS: { title: string; body: string[] }[] = [
    {
        title: '1. Umumiy qoidalar',
        body: [
            "Ushbu Maxfiylik siyosati pack24.uz sayti, Pack24 Telegram botlari va mobil ilovasi (keyingi o'rinlarda \"Servis\") foydalanuvchilarining shaxsiy ma'lumotlariga nisbatan qo'llaniladi.",
            "Servisdan foydalanish orqali siz ushbu siyosat shartlariga rozilik bildirasiz. Ma'lumotlar O'zbekiston Respublikasining \"Shaxsga doir ma'lumotlar to'g'risida\"gi Qonuniga muvofiq qayta ishlanadi.",
        ],
    },
    {
        title: "2. Qanday ma'lumotlar yig'iladi",
        body: [
            "Buyurtma berish va ro'yxatdan o'tishda: ism, telefon raqami, yetkazib berish manzili va (ixtiyoriy) xaritadagi joylashuv, elektron pochta.",
            "Qayta ishlash (makulatura) arizalarida: ism, telefon, olib ketish manzili va ariza tafsilotlari.",
            "Texnik ma'lumotlar: IP manzil, brauzer turi, tashrif buyurilgan sahifalar, cookie fayllari (Google Analytics va Yandex Metrika orqali).",
            "Bank karta ma'lumotlari Pack24 serverlarida saqlanmaydi: to'lov Click va Payme tizimlarining o'z sahifalarida amalga oshiriladi.",
        ],
    },
    {
        title: "3. Ma'lumotlar nima uchun ishlatiladi",
        body: [
            "Buyurtmalarni qabul qilish, tayyorlash, yetkazib berish va to'lovni tasdiqlash.",
            "Buyurtma holati haqida SMS yoki Telegram orqali xabar berish.",
            "Mijozlarga xizmat ko'rsatish, savollarga javob berish va Servis sifatini yaxshilash.",
            "Qonunchilikda nazarda tutilgan hisobot va majburiyatlarni bajarish.",
        ],
    },
    {
        title: "4. Ma'lumotlarni uchinchi shaxslarga berish",
        body: [
            "Ma'lumotlar sotilmaydi. Ular faqat xizmat ko'rsatish uchun zarur bo'lgan hamkorlarga beriladi: yetkazib beruvchi kuryerlar, to'lov tizimlari (Click, Payme), SMS xizmati, hosting va ma'lumotlar bazasi provayderlari.",
            "Qonunda belgilangan hollarda vakolatli davlat organlarining so'roviga ko'ra ma'lumotlar taqdim etilishi mumkin.",
        ],
    },
    {
        title: '5. Saqlash muddati va himoya',
        body: [
            "Ma'lumotlar Servis ko'rsatilishi uchun zarur bo'lgan muddat davomida, buxgalteriya hujjatlari esa qonunda belgilangan muddat davomida saqlanadi.",
            "Ma'lumotlar shifrlangan ulanish (HTTPS) orqali uzatiladi, ularga kirish faqat vakolatli xodimlarga ruxsat etiladi.",
        ],
    },
    {
        title: '6. Sizning huquqlaringiz',
        body: [
            "Siz o'z ma'lumotlaringizni ko'rish, tuzatish yoki o'chirishni so'rashingiz mumkin. Buning uchun quyidagi aloqa manzillari orqali murojaat qiling.",
        ],
    },
];

export default function PrivacyPage() {
    return (
        <main className="max-w-3xl mx-auto px-4 py-10 text-gray-800">
            <nav className="text-sm text-gray-500 mb-6">
                <Link href="/" className="hover:text-gray-800">Bosh sahifa</Link>
                <span className="mx-2">/</span>
                <span>Maxfiylik siyosati</span>
            </nav>
            <h1 className="text-3xl font-bold mb-6">Maxfiylik siyosati</h1>
            {SECTIONS.map(section => (
                <section key={section.title} className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
                    {section.body.map(p => (
                        <p key={p} className="mb-2 leading-relaxed">{p}</p>
                    ))}
                </section>
            ))}
            <section className="mb-6">
                <h2 className="text-xl font-semibold mb-2">7. Aloqa</h2>
                <p className="leading-relaxed">
                    Email: <a href="mailto:info@pack24.uz" className="text-blue-600 underline">info@pack24.uz</a>
                    <br />
                    Boshqa aloqa usullari: <Link href="/contacts" className="text-blue-600 underline">Kontaktlar</Link> sahifasi.
                </p>
            </section>
        </main>
    );
}
