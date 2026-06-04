'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Leaf, ArrowRight, TreePine } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// ─── Dynamic import (no SSR for Three.js) ────────────────────────
const VirtualForest = dynamic(() => import('@/components/VirtualForest'), {
  ssr: false,
  loading: () => <LoadingSkeleton />,
});

// ─── i18n ────────────────────────────────────────────────────────
const TX = {
  title: {
    uz: "🌳 Sizning Virtual O'rmoningiz",
    ru: '🌳 Ваш Виртуальный Лес',
    en: '🌳 Your Virtual Forest',
  },
  subtitle: {
    uz: "Qayta ishlash ta'siringiz 3D o'rmon sifatida",
    ru: 'Ваш вклад в переработку в виде 3D-леса',
    en: 'Your recycling impact as a 3D forest',
  },
  trees: {
    uz: 'ta daraxt',
    ru: 'деревьев',
    en: 'trees',
  },
  recycled: {
    uz: 'kg qayta ishlandi',
    ru: 'кг переработано',
    en: 'kg recycled',
  },
  co2Saved: {
    uz: 'kg CO₂ tejaldi',
    ru: 'кг CO₂ сэкономлено',
    en: 'kg CO₂ saved',
  },
  ecoLevel: {
    uz: 'Eco darajangiz',
    ru: 'Ваш Eco уровень',
    en: 'Your Eco level',
  },
  milestone: {
    uz: (remaining: number) => `10 daraxtga yetish uchun yana ${remaining} kg topshiring`,
    ru: (remaining: number) => `До 10 деревьев осталось сдать ${remaining} кг`,
    en: (remaining: number) => `Submit ${remaining} more kg to reach 10 trees`,
  },
  ctaTitle: {
    uz: "Ko'proq daraxt eking",
    ru: 'Посадите больше деревьев',
    en: 'Plant more trees',
  },
  ctaDesc: {
    uz: "Makulatura topshirib, o'rmoningizni kengaytiring",
    ru: 'Сдайте макулатуру и расширьте свой лес',
    en: 'Recycle more to grow your forest',
  },
  loading: {
    uz: "O'rmon yuklanmoqda...",
    ru: 'Лес загружается...',
    en: 'Forest loading...',
  },
  loginRequired: {
    uz: "Virtual o'rmonni ko'rish uchun tizimga kiring",
    ru: 'Войдите, чтобы увидеть виртуальный лес',
    en: 'Log in to see your virtual forest',
  },
  login: {
    uz: 'Tizimga kirish',
    ru: 'Войти',
    en: 'Log in',
  },
  noData: {
    uz: "Hali birorta daraxt yo'q. Makulatura topshirib, o'rmon o'stiring!",
    ru: 'Пока нет деревьев. Сдайте макулатуру, чтобы вырастить лес!',
    en: "No trees yet. Start recycling to grow your forest!",
  },
  goRecycling: {
    uz: 'Makulatura topshirish',
    ru: 'Сдать макулатуру',
    en: 'Start recycling',
  },
} as const;

type TXKey = keyof typeof TX;

// ─── Eco data type ───────────────────────────────────────────────
interface EcoData {
  ecoPoints: number;
  ecoLevel: string;
  totalRecycledWeight: number;
  totalCO2Saved: number;
  treesEquivalent: number;
  ecoStreak: number;
  lastEcoActivity: string | null;
}

// ─── Loading skeleton ────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-100 to-emerald-50 rounded-2xl">
      <div className="flex flex-col items-center gap-3">
        <span className="text-5xl animate-bounce">🌳</span>
        <div className="flex gap-1">
          <span className="text-2xl animate-bounce delay-100">🌱</span>
          <span className="text-2xl animate-bounce delay-200">🌿</span>
          <span className="text-2xl animate-bounce delay-300">🍃</span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────
export default function VirtualForestPage() {
  const { data: session, status } = useSession();
  const { language } = useLanguage();
  const [ecoData, setEcoData] = useState<EcoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = (key: TXKey): string => {
    const entry = TX[key];
    if (typeof entry === 'object' && 'uz' in entry) {
      const val = (entry as Record<string, unknown>)[language] ?? (entry as Record<string, unknown>).en;
      if (typeof val === 'string') return val;
    }
    return key;
  };

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    fetch(`/api/user/eco-progress?userId=${userId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Eco ma\'lumotlarni yuklashda xatolik');
        return res.json();
      })
      .then((data: EcoData) => {
        setEcoData(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  // ── Auth loading ───────────────────────────────────────────────
  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl animate-bounce">🌳</span>
          <p className="text-sm text-emerald-700 font-medium">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // ── Not authenticated ──────────────────────────────────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <TreePine size={48} className="text-emerald-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('loginRequired')}</h2>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 mt-4 bg-emerald-600 text-white px-6 py-2.5 rounded-[10px] font-semibold hover:bg-emerald-700 transition-colors"
          >
            {t('login')}
          </Link>
        </Card>
      </div>
    );
  }

  const treesCount = ecoData?.treesEquivalent ?? 0;
  const totalWeight = ecoData?.totalRecycledWeight ?? 0;
  const co2Saved = ecoData?.totalCO2Saved ?? 0;
  const ecoLevel = ecoData?.ecoLevel ?? 'Yangi';

  // Milestone: trees until next 10 milestone
  const nextMilestone = Math.ceil((treesCount + 1) / 10) * 10;
  const treesNeeded = nextMilestone - treesCount;
  // Rough: ~10kg per tree equivalent
  const kgNeeded = treesNeeded * 10;

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 via-green-600 to-teal-600 text-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t('title')}
          </h1>
          <p className="text-emerald-100 mt-1 text-sm sm:text-base">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* 3D Forest */}
        <div className="relative w-full rounded-2xl overflow-hidden shadow-xl border border-emerald-200 dark:border-emerald-800/40" style={{ height: 'clamp(320px, 55vh, 600px)' }}>
          {treesCount > 0 ? (
            <VirtualForest
              treesCount={treesCount}
              totalWeight={totalWeight}
              co2Saved={co2Saved}
              ecoLevel={ecoLevel}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-100 to-emerald-50">
              <div className="text-center space-y-4 p-8">
                <span className="text-6xl">🌱</span>
                <p className="text-emerald-700 font-medium max-w-sm">{t('noData')}</p>
                <Link href="/recycling">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6">
                    {t('goRecycling')}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-100 dark:border-emerald-900/30 text-center">
            <div className="p-4">
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{treesCount}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">🌳 {t('trees')}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border-blue-100 dark:border-blue-900/30 text-center">
            <div className="p-4">
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{totalWeight}</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">♻️ {t('recycled')}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background border-cyan-100 dark:border-cyan-900/30 text-center">
            <div className="p-4">
              <p className="text-3xl font-bold text-cyan-700 dark:text-cyan-400">{co2Saved}</p>
              <p className="text-xs text-cyan-600 dark:text-cyan-500 mt-1">💨 {t('co2Saved')}</p>
            </div>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-background border-amber-100 dark:border-amber-900/30 text-center">
            <div className="p-4">
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{ecoLevel}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">🏆 {t('ecoLevel')}</p>
            </div>
          </Card>
        </div>

        {/* Milestone */}
        {treesCount > 0 && treesCount < nextMilestone && (
          <Card className="border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/10">
            <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">
                    🎯 {nextMilestone} {t('trees')}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-500">
                    {typeof TX.milestone[language as 'uz' | 'ru' | 'en'] === 'function'
                      ? (TX.milestone[language as 'uz' | 'ru' | 'en'] as (n: number) => string)(kgNeeded)
                      : (TX.milestone.en as (n: number) => string)(kgNeeded)
                    }
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full sm:w-48">
                <div className="h-2 bg-emerald-200 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min((treesCount / nextMilestone) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-1 text-right">
                  {treesCount}/{nextMilestone}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* CTA */}
        <Link href="/recycling" className="block group">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-green-500 px-6 py-6 shadow-md transition-all hover:shadow-xl hover:-translate-y-1">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TreePine className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t('ctaTitle')}</h3>
                  <p className="text-sm text-emerald-100">{t('ctaDesc')}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>

        {error && (
          <p className="text-center text-sm text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
