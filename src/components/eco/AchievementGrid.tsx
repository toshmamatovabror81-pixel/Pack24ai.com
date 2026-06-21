'use client';

import React from 'react';
import { Award } from 'lucide-react';
import { BADGE_DEFINITIONS } from '@/lib/eco/achievements';
import AchievementBadge from './AchievementBadge';

interface EarnedBadge {
  badgeKey: string;
  earnedAt: string;
}

interface AchievementGridProps {
  earnedBadges: EarnedBadge[];
  language?: 'uz' | 'ru';
}

const gridLabels = {
  uz: {
    title: 'Yutuqlar',
    subtitle: 'Ekologik muvaffaqiyatlaringiz',
    earned: 'yutuqlar qo\'lga kiritildi',
  },
  ru: {
    title: 'Достижения',
    subtitle: 'Ваши экологические успехи',
    earned: 'достижений получено',
  },
};

export default function AchievementGrid({
  earnedBadges,
  language = 'uz',
}: AchievementGridProps) {
  const t = gridLabels[language];
  const earnedMap = new Map(
    earnedBadges.map((b) => [b.badgeKey, b.earnedAt])
  );
  const total = BADGE_DEFINITIONS.length;
  const earnedCount = earnedBadges.length;
  const completionPct = Math.round((earnedCount / total) * 100);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-6 ring-1 ring-white/[0.06]">
      {/* Background decoration */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/[0.04] blur-2xl" />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <Award className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t.title}</h3>
            <p className="text-xs text-gray-500">{t.subtitle}</p>
          </div>
        </div>

        {/* Count pill */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-400">
            <span>{earnedCount}</span>
            <span className="text-amber-400/50">/</span>
            <span className="text-amber-400/70">{total}</span>
          </div>
          <p className="text-[10px] text-gray-600">{t.earned}</p>
        </div>
      </div>

      {/* Completion bar */}
      <div className="mb-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-1000 ease-out"
            style={{
              width: `${completionPct}%`,
              boxShadow: '0 0 10px rgba(245,158,11,0.4)',
            }}
          />
        </div>
      </div>

      {/* Badge grid */}
      <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
        {BADGE_DEFINITIONS.map((badge) => {
          const earnedAt = earnedMap.get(badge.key);
          return (
            <div key={badge.key} className="flex justify-center">
              <AchievementBadge
                badgeKey={badge.key}
                earned={!!earnedAt}
                earnedAt={earnedAt}
                language={language}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
