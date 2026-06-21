'use client';

import React from 'react';
import { Trophy, ChevronRight, Crown, Medal } from 'lucide-react';
import { getLevelByWeight } from '@/lib/eco/levels';

interface LeaderboardEntry {
  rank: number;
  name: string;
  ecoLevel: string;
  totalKg: number;
  isCurrentUser?: boolean;
}

interface EcoLeaderboardCardProps {
  leaderboard: LeaderboardEntry[];
  language?: 'uz' | 'ru';
}

const leaderboardLabels = {
  uz: {
    title: 'Reyting',
    subtitle: 'Top yig\'uvchilar',
    showMore: 'Ko\'proq ko\'rish',
    kg: 'kg',
    you: 'Siz',
  },
  ru: {
    title: 'Рейтинг',
    subtitle: 'Топ сборщики',
    showMore: 'Показать больше',
    kg: 'кг',
    you: 'Вы',
  },
};

const rankMedals: Record<number, { icon: React.ReactNode; color: string; bg: string }> = {
  1: {
    icon: <Crown className="h-4 w-4" />,
    color: '#FBBF24',
    bg: 'rgba(251,191,36,0.12)',
  },
  2: {
    icon: <Medal className="h-4 w-4" />,
    color: '#94A3B8',
    bg: 'rgba(148,163,184,0.10)',
  },
  3: {
    icon: <Medal className="h-4 w-4" />,
    color: '#CD7F32',
    bg: 'rgba(205,127,50,0.10)',
  },
};

export default function EcoLeaderboardCard({
  leaderboard,
  language = 'uz',
}: EcoLeaderboardCardProps) {
  const t = leaderboardLabels[language];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-6 ring-1 ring-white/[0.06]">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-yellow-500/[0.04] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-emerald-500/[0.03] blur-2xl" />

      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
            <Trophy className="h-5 w-5 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t.title}</h3>
            <p className="text-xs text-gray-500">{t.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Leaderboard list */}
      <div className="space-y-1.5">
        {leaderboard.slice(0, 5).map((entry) => {
          const level = getLevelByWeight(entry.totalKg);
          const medal = rankMedals[entry.rank];

          return (
            <div
              key={entry.rank}
              className={`
                group relative flex items-center gap-3 rounded-xl px-3 py-2.5
                transition-all duration-200
                ${entry.isCurrentUser
                  ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 ring-1 ring-emerald-500/20'
                  : 'hover:bg-white/[0.03]'
                }
              `}
            >
              {/* Rank */}
              <div
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                style={
                  medal
                    ? { color: medal.color, background: medal.bg }
                    : { color: '#6B7280', background: 'rgba(55, 65, 81, 0.4)' }
                }
              >
                {medal ? medal.icon : entry.rank}
              </div>

              {/* Level emoji */}
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg"
                style={{
                  background: `${level.color}18`,
                }}
              >
                {level.emoji}
              </div>

              {/* Name & level */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className={`truncate text-sm font-semibold ${
                      entry.isCurrentUser ? 'text-emerald-400' : 'text-gray-200'
                    }`}
                  >
                    {entry.name}
                  </p>
                  {entry.isCurrentUser && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                      {t.you}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {language === 'ru' ? level.nameRu : level.nameUz}
                </p>
              </div>

              {/* KG */}
              <div className="flex-shrink-0 text-right">
                <p
                  className="text-sm font-bold tabular-nums"
                  style={{
                    color: entry.isCurrentUser ? '#34D399' : level.color,
                  }}
                >
                  {entry.totalKg.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-600">{t.kg}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more link */}
      <button
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.03] py-2.5 text-sm font-medium text-gray-400 transition-all duration-200 hover:bg-white/[0.06] hover:text-gray-200"
      >
        {t.showMore}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
