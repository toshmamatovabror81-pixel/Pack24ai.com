"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Leaf,
  TreePine,
  CloudSun,
  MapPin,
  ArrowLeft,
  Recycle,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/lib/contexts/LanguageContext";

// ─── i18n ────────────────────────────────────────────────────────────────────

type TxKey =
  | "title"
  | "subtitle"
  | "totalRecycled"
  | "co2Saved"
  | "treesSaved"
  | "activeCities"
  | "kg"
  | "ta"
  | "rank"
  | "city"
  | "region"
  | "weight"
  | "co2"
  | "trees"
  | "trend"
  | "users"
  | "requests"
  | "ctaTitle"
  | "ctaDesc"
  | "ctaButton"
  | "back"
  | "loading"
  | "noData"
  | "place";

const TX: Record<string, Partial<Record<TxKey, string>>> = {
  uz: {
    title: "🌍 O'zbekiston Yashil Reytingi",
    subtitle: "Shaharlar bo'yicha ekologik ko'rsatkichlar",
    totalRecycled: "Jami qayta ishlangan",
    co2Saved: "CO₂ tejaldi",
    treesSaved: "Daraxtlar asrandi",
    activeCities: "Faol shaharlar",
    kg: "kg",
    ta: "ta",
    rank: "#",
    city: "Shahar",
    region: "Viloyat",
    weight: "Qayta ishlangan (kg)",
    co2: "CO₂ (kg)",
    trees: "Daraxtlar",
    trend: "Trend",
    users: "Foydalanuvchilar",
    requests: "Arizalar",
    ctaTitle: "Sizning shahringiz reytingda qayerda?",
    ctaDesc:
      "Makulatura topshirib, shahringiz reytingini oshiring va tabiatni asrang!",
    ctaButton: "Makulatura topshirish",
    back: "Orqaga",
    loading: "Reyting yuklanmoqda...",
    noData: "Hozircha ma'lumot mavjud emas",
    place: "-o'rin",
  },
  ru: {
    title: "🌍 Зелёный Рейтинг Узбекистана",
    subtitle: "Экологические показатели по городам",
    totalRecycled: "Всего переработано",
    co2Saved: "CO₂ сэкономлено",
    treesSaved: "Деревья спасены",
    activeCities: "Активные города",
    kg: "кг",
    ta: "шт",
    rank: "#",
    city: "Город",
    region: "Регион",
    weight: "Переработано (кг)",
    co2: "CO₂ (кг)",
    trees: "Деревья",
    trend: "Тренд",
    users: "Пользователи",
    requests: "Заявки",
    ctaTitle: "Где ваш город в рейтинге?",
    ctaDesc:
      "Сдавайте макулатуру, повышайте рейтинг города и берегите природу!",
    ctaButton: "Сдать макулатуру",
    back: "Назад",
    loading: "Рейтинг загружается...",
    noData: "Данных пока нет",
    place: "-е место",
  },
  en: {
    title: "🌍 Uzbekistan Green Ranking",
    subtitle: "Environmental indicators by city",
    totalRecycled: "Total recycled",
    co2Saved: "CO₂ saved",
    treesSaved: "Trees saved",
    activeCities: "Active cities",
    kg: "kg",
    ta: "pcs",
    rank: "#",
    city: "City",
    region: "Region",
    weight: "Recycled (kg)",
    co2: "CO₂ (kg)",
    trees: "Trees",
    trend: "Trend",
    users: "Users",
    requests: "Requests",
    ctaTitle: "Where is your city in the ranking?",
    ctaDesc: "Recycle paper, boost your city's ranking, and save nature!",
    ctaButton: "Start recycling",
    back: "Back",
    loading: "Loading rankings...",
    noData: "No data available yet",
    place: "place",
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface CityEntry {
  rank: number;
  cityUz: string;
  cityRu: string;
  regionUz: string;
  regionRu: string;
  totalWeight: number;
  co2Saved: number;
  treesEquivalent: number;
  activeUsers: number;
  requestCount: number;
}

interface TotalStats {
  totalWeight: number;
  co2Saved: number;
  treesEquivalent: number;
  totalActiveCities: number;
  totalActiveUsers: number;
  totalRequests: number;
}

interface LeaderboardData {
  leaderboard: CityEntry[];
  totalStats: TotalStats;
}

// ─── Animated Counter Hook ──────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 1500): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    const startTime = performance.now();
    const startValue = 0;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(startValue + (target - startValue) * eased);
      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  unit,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  delay: number;
}) {
  const animated = useAnimatedCounter(value);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 transition-all duration-700 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-8"
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-sm font-medium text-white/80">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">
        {animated.toLocaleString()}
        <span className="text-lg font-normal text-white/60 ml-1">{unit}</span>
      </div>
    </div>
  );
}

// ─── Podium Card ────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  place,
  height,
  accentColor,
  medal,
  lang,
  delay,
}: {
  entry: CityEntry;
  place: number;
  height: string;
  accentColor: string;
  medal: string;
  lang: string;
  delay: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const cityName = lang === "ru" ? entry.cityRu : entry.cityUz;

  return (
    <div
      className={`flex flex-col items-center transition-all duration-1000 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
      }`}
    >
      {/* Medal & City */}
      <div className="text-4xl mb-2">{medal}</div>
      <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">
        {cityName}
      </h3>
      <p className="text-sm text-gray-500 mb-3">
        {Math.round(entry.totalWeight).toLocaleString()} kg
      </p>

      {/* Podium bar */}
      <div
        className={`w-full rounded-t-2xl flex items-end justify-center pb-4 transition-all duration-1000 ${accentColor} ${
          visible ? height : "h-0"
        }`}
      >
        <span className="text-3xl font-black text-white/90">{place}</span>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const { language } = useLanguage();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = useCallback(
    (key: TxKey): string => TX[language]?.[key] ?? TX.uz[key] ?? key,
    [language]
  );

  useEffect(() => {
    fetch("/api/eco/leaderboard/city")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Server error");
        return json as LeaderboardData;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[70vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Recycle className="h-12 w-12 text-emerald-500 animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-emerald-200 animate-ping opacity-30" />
          </div>
          <p className="text-sm text-gray-500 font-medium">{t("loading")}</p>
          {/* Skeleton cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 w-full max-w-4xl">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
          <div className="w-full max-w-4xl space-y-3 mt-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-gray-100 animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            {language === "ru" ? "Повторить" : language === "en" ? "Retry" : "Qayta urinish"}
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { leaderboard, totalStats } = data;
  const maxWeight = leaderboard[0]?.totalWeight || 1;
  const top3 = leaderboard.slice(0, 3);

  const getCityName = (entry: CityEntry) =>
    language === "ru" ? entry.cityRu : entry.cityUz;
  const getRegionName = (entry: CityEntry) =>
    language === "ru" ? entry.regionRu : entry.regionUz;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* ═══ HERO SECTION ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-radial-gradient opacity-10" />
          {/* Floating leaf emojis */}
          <div className="absolute top-12 left-[10%] text-3xl opacity-20 animate-bounce" style={{ animationDuration: "3s" }}>🍃</div>
          <div className="absolute top-24 right-[15%] text-2xl opacity-15 animate-bounce" style={{ animationDuration: "4s", animationDelay: "1s" }}>🌿</div>
          <div className="absolute bottom-16 left-[25%] text-2xl opacity-20 animate-bounce" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }}>🌱</div>
          <div className="absolute bottom-8 right-[30%] text-3xl opacity-15 animate-bounce" style={{ animationDuration: "4.5s", animationDelay: "2s" }}>♻️</div>
        </div>

        <div className="relative z-10 container mx-auto px-4 py-12 md:py-16">
          {/* Back button */}
          <Link
            href="/eco-dashboard"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Link>

          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
              {t("title")}
            </h1>
            <p className="text-emerald-100/80 text-lg max-w-2xl mx-auto">
              {t("subtitle")}
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            <StatCard
              icon={<Recycle className="h-5 w-5 text-white" />}
              label={t("totalRecycled")}
              value={Math.round(totalStats.totalWeight)}
              unit={t("kg")}
              delay={100}
            />
            <StatCard
              icon={<CloudSun className="h-5 w-5 text-white" />}
              label={t("co2Saved")}
              value={Math.round(totalStats.co2Saved)}
              unit={t("kg")}
              delay={250}
            />
            <StatCard
              icon={<TreePine className="h-5 w-5 text-white" />}
              label={t("treesSaved")}
              value={totalStats.treesEquivalent}
              unit={t("ta")}
              delay={400}
            />
            <StatCard
              icon={<MapPin className="h-5 w-5 text-white" />}
              label={t("activeCities")}
              value={totalStats.totalActiveCities}
              unit={t("ta")}
              delay={550}
            />
          </div>
        </div>
      </section>

      {/* ═══ TOP 3 PODIUM ═══ */}
      {top3.length >= 3 && (
        <section className="container mx-auto px-4 -mt-2 mb-12">
          <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-100 p-8 pt-10">
            <div className="flex items-center justify-center gap-2 mb-8">
              <Trophy className="h-6 w-6 text-amber-500" />
              <h2 className="text-xl font-bold text-gray-800">
                TOP 3
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-4 items-end">
              {/* 2nd place (left) */}
              <PodiumCard
                entry={top3[1]}
                place={2}
                height="h-32"
                accentColor="bg-gradient-to-t from-gray-400 to-gray-300"
                medal="🥈"
                lang={language}
                delay={400}
              />
              {/* 1st place (center) */}
              <PodiumCard
                entry={top3[0]}
                place={1}
                height="h-44"
                accentColor="bg-gradient-to-t from-amber-500 to-yellow-400"
                medal="🥇"
                lang={language}
                delay={200}
              />
              {/* 3rd place (right) */}
              <PodiumCard
                entry={top3[2]}
                place={3}
                height="h-24"
                accentColor="bg-gradient-to-t from-amber-700 to-amber-600"
                medal="🥉"
                lang={language}
                delay={600}
              />
            </div>
          </div>
        </section>
      )}

      {/* ═══ FULL LEADERBOARD TABLE ═══ */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-6 py-4 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <div className="col-span-1">{t("rank")}</div>
              <div className="col-span-3">{t("city")}</div>
              <div className="col-span-3">{t("weight")}</div>
              <div className="col-span-2 hidden md:block">{t("co2")}</div>
              <div className="col-span-1 hidden md:block">{t("trees")}</div>
              <div className="col-span-2 md:col-span-2 text-right">
                {t("trend")}
              </div>
            </div>

            {/* Rows */}
            {leaderboard.length === 0 ? (
              <div className="px-6 py-16 text-center text-gray-400">
                <Leaf className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">{t("noData")}</p>
              </div>
            ) : (
              leaderboard.map((entry, idx) => {
                const isTop3 = entry.rank <= 3;
                const progressPercent =
                  maxWeight > 0
                    ? Math.max(
                        (entry.totalWeight / maxWeight) * 100,
                        entry.totalWeight > 0 ? 3 : 0
                      )
                    : 0;

                return (
                  <div
                    key={entry.cityUz + entry.regionUz}
                    className={`grid grid-cols-12 gap-2 px-6 py-4 items-center transition-colors hover:bg-emerald-50/50 ${
                      isTop3
                        ? "bg-gradient-to-r from-amber-50/50 to-transparent border-l-4 border-amber-400"
                        : idx % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50/50"
                    }`}
                    style={{
                      animation: `fadeSlideIn 0.4s ease-out ${idx * 60}ms both`,
                    }}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      {isTop3 ? (
                        <span className="text-xl">
                          {entry.rank === 1
                            ? "🥇"
                            : entry.rank === 2
                            ? "🥈"
                            : "🥉"}
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-gray-400 bg-gray-100 rounded-full h-8 w-8 flex items-center justify-center">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    {/* City name */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <div>
                          <p
                            className={`font-semibold text-sm ${
                              isTop3 ? "text-gray-900" : "text-gray-700"
                            }`}
                          >
                            {getCityName(entry)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {getRegionName(entry)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Weight + progress bar */}
                    <div className="col-span-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                isTop3
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                                  : "bg-emerald-400"
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                        <span
                          className={`text-sm font-bold tabular-nums min-w-[60px] text-right ${
                            isTop3 ? "text-emerald-700" : "text-gray-600"
                          }`}
                        >
                          {Math.round(entry.totalWeight).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* CO2 */}
                    <div className="col-span-2 hidden md:flex items-center gap-1">
                      <CloudSun className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-sm text-gray-600 tabular-nums">
                        {Math.round(entry.co2Saved).toLocaleString()}
                      </span>
                    </div>

                    {/* Trees */}
                    <div className="col-span-1 hidden md:flex items-center gap-1">
                      <TreePine className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-sm text-gray-600 tabular-nums">
                        {entry.treesEquivalent}
                      </span>
                    </div>

                    {/* Trend */}
                    <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-1">
                      {entry.totalWeight > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                          <TrendingUp className="h-3 w-3" />
                          ↑
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 text-xs font-medium">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* ═══ CALL TO ACTION ═══ */}
      <section className="container mx-auto px-4 pb-16">
        <div className="max-w-4xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-10 md:p-14 shadow-2xl">
          {/* BG decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/5" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6">
              <Recycle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {t("ctaTitle")}
            </h2>
            <p className="text-emerald-100/80 max-w-xl mb-8 text-lg">
              {t("ctaDesc")}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/recycling"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-emerald-700 rounded-full font-bold text-base shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <Leaf className="h-5 w-5" />
                {t("ctaButton")}
              </Link>
              <Link
                href="/eco-dashboard"
                className="inline-flex items-center gap-2 px-8 py-3.5 border-2 border-white/30 text-white rounded-full font-semibold text-base hover:bg-white/10 transition-all"
              >
                <Trophy className="h-5 w-5" />
                {language === "ru"
                  ? "Мой экопрофиль"
                  : language === "en"
                  ? "My eco profile"
                  : "Mening eko-hisobim"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Keyframe animation ═══ */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
