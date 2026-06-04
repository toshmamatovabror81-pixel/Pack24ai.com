'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Code, Copy, CheckCircle2, Globe, Leaf, Shield, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// ─── i18n ────────────────────────────────────────────────────────
const TX = {
  title: {
    uz: 'Eco Impact Widget',
    ru: 'Eco Impact Виджет',
    en: 'Eco Impact Widget',
  },
  subtitle: {
    uz: 'Kompaniyangiz qayta ishlash statistikasini saytingizga joylashtiring',
    ru: 'Разместите статистику переработки вашей компании на своём сайте',
    en: 'Embed your company recycling stats on your website',
  },
  instruction: {
    uz: 'Ushbu kodni saytingizga joylashtiring',
    ru: 'Вставьте этот код на свой сайт',
    en: 'Paste this code into your website',
  },
  embedCode: {
    uz: 'Embed kod',
    ru: 'Код для встраивания',
    en: 'Embed Code',
  },
  preview: {
    uz: 'Oldindan ko\'rish',
    ru: 'Предпросмотр',
    en: 'Preview',
  },
  copy: {
    uz: 'Nusxa olish',
    ru: 'Копировать',
    en: 'Copy',
  },
  copied: {
    uz: 'Nusxa olindi!',
    ru: 'Скопировано!',
    en: 'Copied!',
  },
  howItWorks: {
    uz: 'Qanday ishlaydi',
    ru: 'Как это работает',
    en: 'How it works',
  },
  step1: {
    uz: 'Yuqoridagi kodni nusxa oling',
    ru: 'Скопируйте код выше',
    en: 'Copy the code above',
  },
  step2: {
    uz: 'Saytingiz HTML kodiga joylashtiring',
    ru: 'Вставьте в HTML код вашего сайта',
    en: 'Paste it into your website HTML',
  },
  step3: {
    uz: 'Widget avtomatik yuklanadi va yangilanadi',
    ru: 'Виджет загрузится и будет обновляться автоматически',
    en: 'The widget loads and updates automatically',
  },
  features: {
    uz: 'Xususiyatlar',
    ru: 'Возможности',
    en: 'Features',
  },
  featureRealtime: {
    uz: 'Real-time statistika — har 5 daqiqada yangilanadi',
    ru: 'Статистика в реальном времени — обновляется каждые 5 минут',
    en: 'Real-time stats — updates every 5 minutes',
  },
  featureResponsive: {
    uz: 'Responsive dizayn — barcha qurilmalarda ishlaydi',
    ru: 'Адаптивный дизайн — работает на всех устройствах',
    en: 'Responsive design — works on all devices',
  },
  featureNoCss: {
    uz: 'Tashqi CSS kerak emas — barcha stillar inline',
    ru: 'Не нужен внешний CSS — все стили встроены',
    en: 'No external CSS needed — all styles are inline',
  },
  loginRequired: {
    uz: 'Widget olish uchun tizimga kiring',
    ru: 'Войдите в систему для получения виджета',
    en: 'Log in to get the widget',
  },
  corporateOnly: {
    uz: 'Bu funksiya faqat korporativ hisoblar uchun mavjud',
    ru: 'Эта функция доступна только для корпоративных аккаунтов',
    en: 'This feature is available for corporate accounts only',
  },
  contactUs: {
    uz: 'Korporativ hisobga o\'tish uchun biz bilan bog\'laning',
    ru: 'Свяжитесь с нами для перехода на корпоративный аккаунт',
    en: 'Contact us to upgrade to a corporate account',
  },
} as const;

type TXKey = keyof typeof TX;

// ─── Page ────────────────────────────────────────────────────────
export default function EcoWidgetPage() {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isCorporate, setIsCorporate] = useState<boolean | null>(null);

  const t = (key: TXKey): string => {
    const entry = TX[key];
    return (entry as Record<string, string>)[language] || (entry as Record<string, string>).en || '';
  };

  const userId = session?.user?.id;

  // Check if user is corporate
  useEffect(() => {
    if (!userId) return;
    fetch('/api/eco/widget/' + userId)
      .then((res) => {
        if (res.status === 403) {
          setIsCorporate(false);
        } else if (res.ok) {
          setIsCorporate(true);
        } else {
          setIsCorporate(false);
        }
      })
      .catch(() => setIsCorporate(false));
  }, [userId]);

  const embedCode = `<script src="https://pack24.uz/widget/eco-impact.js" data-company="${userId || 'YOUR_ID'}"></script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Loading ────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <Shield size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('loginRequired')}</h2>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 mt-4 bg-brand-green text-white px-6 py-2.5 rounded-[10px] font-semibold hover:bg-[#053d2e] transition-colors"
          >
            Login
          </Link>
        </Card>
      </div>
    );
  }

  // ── Not corporate ──────────────────────────────────────────────
  if (isCorporate === false) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <Shield size={48} className="text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('corporateOnly')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('contactUs')}</p>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm font-medium"
          >
            <ExternalLink size={14} />
            Support
          </Link>
        </Card>
      </div>
    );
  }

  // ── Main Page ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-950 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-semibold text-emerald-200 mb-6">
            <Leaf size={12} className="text-emerald-400" />
            Eco Widget
          </div>
          <h1 className="text-3xl lg:text-5xl font-extrabold mb-4 leading-tight">
            {t('title')}
          </h1>
          <p className="text-base text-emerald-100/70 max-w-xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {/* Preview */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-gray-100">
            <Globe size={16} className="text-emerald-600" />
            <h2 className="font-bold text-gray-900">{t('preview')}</h2>
          </div>
          <div className="p-6 bg-gray-50 flex justify-center">
            <div className="w-full max-w-[400px]">
              <iframe
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                  <head><meta charset="UTF-8"></head>
                  <body style="margin:0;padding:16px;background:transparent;">
                    <script src="https://pack24.uz/widget/eco-impact.js" data-company="${userId}"><\/script>
                  </body>
                  </html>
                `}
                sandbox="allow-scripts allow-same-origin"
                style={{
                  width: '100%',
                  height: '320px',
                  border: 'none',
                  borderRadius: '12px',
                  background: 'transparent',
                }}
                title="Eco Impact Widget Preview"
              />
            </div>
          </div>
        </Card>

        {/* Embed Code */}
        <Card>
          <div className="flex items-center gap-2 p-4 border-b border-gray-100">
            <Code size={16} className="text-emerald-600" />
            <h2 className="font-bold text-gray-900">{t('embedCode')}</h2>
          </div>
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-600">{t('instruction')}</p>

            <div className="relative">
              <pre className="bg-gray-900 text-emerald-300 p-4 pr-14 rounded-xl text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                {embedCode}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-white"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <Copy size={16} />
                )}
              </Button>
            </div>

            {copied && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                <CheckCircle2 size={14} />
                {t('copied')}
              </div>
            )}
          </div>
        </Card>

        {/* How it works */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{t('howItWorks')}</h3>
            </div>
            <div className="p-4">
              <ol className="space-y-4">
                {(['step1', 'step2', 'step3'] as const).map((key, i) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-700 pt-1">{t(key)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">{t('features')}</h3>
            </div>
            <div className="p-4">
              <ul className="space-y-4">
                {(['featureRealtime', 'featureResponsive', 'featureNoCss'] as const).map((key) => (
                  <li key={key} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{t(key)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
