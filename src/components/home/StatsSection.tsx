'use client';

import { useAnimatedCounter } from '@/lib/hooks/useAnimatedCounter';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import type { Language } from '@/lib/translations';

type L = Record<Language, string>;

const STATS: { target: number; suffix: string; label: L }[] = [
    {
        target: 5000, suffix: '+',
        label: { uz: 'Faol mijoz', ru: 'Активных клиентов', en: 'Active clients', qr: 'Aktiv mijozlar', zh: '活跃客户', tr: 'Aktif Müşteri', tg: 'Мизоҷони фаъол', kk: 'Белсенді клиенттер', tk: 'Işjeň müşderiler', fa: 'مشتریان فعال' },
    },
    {
        target: 40, suffix: '+',
        label: { uz: 'Mahsulot kategoriyasi', ru: 'Категорий товаров', en: 'Product categories', qr: 'Mahsulot kategoriyalari', zh: '商品类别', tr: 'Ürün kategorisi', tg: 'Категорияҳои маҳсулот', kk: 'Тауар санаттары', tk: 'Haryt kategoriýalary', fa: 'دسته‌بندی محصول' },
    },
    {
        target: 1500, suffix: '+',
        label: { uz: 'Mahsulot turi', ru: 'Видов продуктов', en: 'Product types', qr: 'Mahsulot turleri', zh: '产品种类', tr: 'Ürün çeşidi', tg: 'Намудҳои маҳсулот', kk: 'Тауар түрлері', tk: 'Haryt görnüşleri', fa: 'انواع محصول' },
    },
    {
        target: 98, suffix: '%',
        label: { uz: 'Mijoz qoniqishi', ru: 'Удовлетворённость', en: 'Customer satisfaction', qr: 'Mijoz qanaaati', zh: '客户满意度', tr: 'Müşteri memnuniyeti', tg: 'Қаноатмандии мизоҷ', kk: 'Клиент қанағаттануы', tk: 'Müşderi kanagatlanmasy', fa: 'رضایت مشتری' },
    },
];

const HEADING: Record<Language, string> = {
    uz: 'Pack24 raqamlarda', ru: 'Pack24 в цифрах', en: 'Pack24 in Numbers',
    qr: 'Pack24 sanlarda', zh: 'Pack24 数据', tr: "Pack24 Rakamlarla",
    tg: 'Pack24 дар рақамҳо', kk: 'Pack24 сандарда', tk: 'Pack24 sanlarynda', fa: 'Pack24 در اعداد',
};
const SUBHEADING: Record<Language, string> = {
    uz: "Bizning yutuqlarimiz sizning ishonchingiz", ru: 'Наши достижения — ваше доверие',
    en: 'Our achievements — your trust', qr: "Bizin jetiskenlerimiz — sizin iseniminiz",
    zh: '我们的成就，您的信赖', tr: 'Başarılarımız — güveniniz',
    tg: 'Дастовардҳои мо — эътимоди шумо', kk: 'Жетістіктеріміз — сіздің сенімдеріңіз',
    tk: 'Üstünliklerimiz — ynam berýär', fa: 'دستاوردهای ما — اعتماد شما',
};

function StatCard({ target, suffix, label }: { target: number; suffix: string; label: string }) {
    const { value, ref } = useAnimatedCounter(target);
    return (
        <div ref={ref}>
            <p className="text-4xl lg:text-5xl font-black text-white mb-2">
                {value.toLocaleString()}{suffix}
            </p>
            <p className="text-emerald-200 text-sm font-medium">{label}</p>
        </div>
    );
}

export default function StatsSection() {
    const { language } = useLanguage();

    return (
        <section className="bg-gradient-to-r from-brand-navy to-brand-accent py-14">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-2">
                        {HEADING[language] ?? HEADING.uz}
                    </h2>
                    <p className="text-blue-200/70 text-sm">
                        {SUBHEADING[language] ?? SUBHEADING.uz}
                    </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                    {STATS.map((s) => (
                        <StatCard
                            key={s.target}
                            target={s.target}
                            suffix={s.suffix}
                            label={s.label[language] ?? s.label.uz}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
