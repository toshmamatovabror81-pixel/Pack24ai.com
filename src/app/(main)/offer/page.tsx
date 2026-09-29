import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Ommaviy oferta',
    description: "pack24.uz orqali qadoqlash mahsulotlarini sotib olish shartlari (ommaviy oferta shartnomasi).",
    alternates: { canonical: '/offer' },
};

const SECTIONS: { title: string; body: string[] }[] = [
    {
        title: '1. Umumiy qoidalar',
        body: [
            "Ushbu hujjat Pack24 (keyingi o'rinlarda \"Sotuvchi\") tomonidan pack24.uz sayti, Telegram botlari va mobil ilova orqali mahsulot sotish shartlarini belgilaydigan ommaviy oferta hisoblanadi (O'zbekiston Respublikasi Fuqarolik kodeksining 367, 369-moddalari).",
            "Buyurtmani rasmiylashtirish va/yoki to'lovni amalga oshirish oferta shartlarini to'liq qabul qilish (aksept) hisoblanadi.",
        ],
    },
    {
        title: '2. Shartnoma predmeti',
        body: [
            "Sotuvchi Xaridorga saytda ko'rsatilgan qadoqlash mahsulotlarini (gofrokartonli qutilar, paketlar, skotch, stretch plyonka va boshqalar) sotadi, Xaridor esa ularni qabul qiladi va haqini to'laydi.",
            "Mahsulot tavsifi, o'lchamlari va rasmlari saytda keltirilgan. Rang va ko'rinishda ekran sozlamalariga bog'liq kichik farqlar bo'lishi mumkin.",
        ],
    },
    {
        title: '3. Narx va to\'lov',
        body: [
            "Narxlar O'zbekiston so'mida ko'rsatiladi. Buyurtma summasi buyurtma rasmiylashtirilgan paytdagi narxlar bo'yicha server tomonidan hisoblanadi.",
            "To'lov usullari: Click, Payme yoki yetkazib berishda naqd pul. Yuridik shaxslar uchun hisob-faktura asosida bank o'tkazmasi.",
            "Onlayn to'lov to'lov tizimi buyurtma summasini tasdiqlagan paytdan boshlab amalga oshirilgan hisoblanadi.",
        ],
    },
    {
        title: '4. Yetkazib berish',
        body: [
            "Yetkazib berish shartlari, muddatlari va narxi Yetkazib berish sahifasida ko'rsatilgan. O'zingiz olib ketish ham mumkin.",
            "Mahsulotni qabul qilishda Xaridor miqdor va tashqi ko'rinishini tekshirishi kerak.",
        ],
    },
    {
        title: '5. Qaytarish va almashtirish',
        body: [
            "Sifatsiz yoki buyurtmaga mos kelmaydigan mahsulot \"Iste'molchilarning huquqlarini himoya qilish to'g'risida\"gi Qonunga muvofiq almashtiriladi yoki uning puli qaytariladi.",
            "Xaridorning individual o'lchami yoki dizayni bo'yicha tayyorlangan (pechatli) mahsulot, sifat nuqsoni bo'lmasa, qaytarib olinmaydi.",
            "Onlayn to'lov qaytarilganda pul to'lov qilingan karta yoki hisobga qaytariladi.",
        ],
    },
    {
        title: "6. Tomonlarning javobgarligi",
        body: [
            "Tomonlar o'z majburiyatlarini bajarmaganlik uchun O'zbekiston Respublikasi qonunchiligiga muvofiq javob beradilar.",
            "Fors-major holatlarida (tabiiy ofat, davlat organlari qarorlari va h.k.) tomonlar javobgarlikdan ozod qilinadi.",
        ],
    },
    {
        title: "7. Nizolarni hal qilish",
        body: [
            "Nizolar avval muzokaralar yo'li bilan, kelishilmagan taqdirda O'zbekiston Respublikasi qonunchiligiga muvofiq sud tartibida hal qilinadi.",
        ],
    },
    {
        title: "8. Shaxsiy ma'lumotlar",
        body: [
            "Xaridor ma'lumotlari Maxfiylik siyosatiga muvofiq qayta ishlanadi.",
        ],
    },
];

export default function OfferPage() {
    return (
        <main className="max-w-3xl mx-auto px-4 py-10 text-gray-800">
            <nav className="text-sm text-gray-500 mb-6">
                <Link href="/" className="hover:text-gray-800">Bosh sahifa</Link>
                <span className="mx-2">/</span>
                <span>Ommaviy oferta</span>
            </nav>
            <h1 className="text-3xl font-bold mb-6">Ommaviy oferta</h1>
            {SECTIONS.map(section => (
                <section key={section.title} className="mb-6">
                    <h2 className="text-xl font-semibold mb-2">{section.title}</h2>
                    {section.body.map(p => (
                        <p key={p} className="mb-2 leading-relaxed">{p}</p>
                    ))}
                </section>
            ))}
            <p className="text-sm text-gray-500 mt-8">
                Batafsil: <Link href="/delivery" className="text-blue-600 underline">Yetkazib berish</Link>,{' '}
                <Link href="/privacy" className="text-blue-600 underline">Maxfiylik siyosati</Link>,{' '}
                <Link href="/contacts" className="text-blue-600 underline">Kontaktlar</Link>.
            </p>
        </main>
    );
}
