'use client';

import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { getBadgeInfo, type BadgeKey } from '@/lib/eco/achievements';

interface AchievementBadgeProps {
  badgeKey: string;
  earned?: boolean;
  earnedAt?: Date | string;
  language?: 'uz' | 'ru';
}

const dateLabels = {
  uz: 'Qo\'lga kiritildi',
  ru: 'Получено',
};

export default function AchievementBadge({
  badgeKey,
  earned = false,
  earnedAt,
  language = 'uz',
}: AchievementBadgeProps) {
  const badge = getBadgeInfo(badgeKey as BadgeKey);
  const [showTooltip, setShowTooltip] = useState(false);

  if (!badge) return null;

  const badgeName = language === 'ru' ? badge.nameRu : badge.nameUz;

  const formattedDate = earnedAt
    ? new Date(earnedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'uz-UZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="group relative flex flex-col items-center gap-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-16 z-50 w-48 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="rounded-xl bg-gray-800 px-3 py-2 text-center shadow-xl ring-1 ring-white/10">
            <p className="text-xs font-semibold text-white">{badgeName}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">
              {badge.descriptionUz}
            </p>
          </div>
          <div className="mx-auto h-2 w-2 -translate-y-[1px] rotate-45 bg-gray-800" />
        </div>
      )}

      {/* Badge circle */}
      <div
        className={`
          relative flex h-[72px] w-[72px] items-center justify-center rounded-full
          transition-all duration-300
          ${earned
            ? 'cursor-pointer hover:scale-110 hover:shadow-2xl'
            : 'cursor-default grayscale'
          }
        `}
        style={{
          background: earned
            ? `linear-gradient(145deg, ${badge.color}30, ${badge.color}15)`
            : 'rgba(55, 65, 81, 0.3)',
          boxShadow: earned
            ? `0 0 24px ${badge.color}30, inset 0 0 20px ${badge.color}10`
            : 'none',
          opacity: earned ? 1 : 0.45,
        }}
      >
        {/* Animated ring */}
        <div
          className={`
            absolute inset-0 rounded-full
            ${earned ? 'animate-pulse' : ''}
          `}
          style={{
            border: `2px solid ${earned ? badge.color + '50' : 'rgba(75, 85, 99, 0.3)'}`,
            animationDuration: '3s',
          }}
        />

        {/* Inner ring */}
        <div
          className="absolute inset-[3px] rounded-full"
          style={{
            border: `1.5px solid ${earned ? badge.color + '25' : 'rgba(75, 85, 99, 0.15)'}`,
          }}
        />

        {/* Emoji */}
        <span className="relative z-10 text-3xl leading-none select-none">
          {badge.emoji}
        </span>

        {/* Lock overlay for unearned */}
        {!earned && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-gray-900/40">
            <Lock className="h-5 w-5 text-gray-500" />
          </div>
        )}

        {/* Shine effect on hover for earned */}
        {earned && (
          <div
            className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${badge.color}20, transparent 60%)`,
            }}
          />
        )}
      </div>

      {/* Badge name */}
      <p
        className={`max-w-[80px] text-center text-[11px] font-semibold leading-tight ${
          earned ? 'text-gray-200' : 'text-gray-600'
        }`}
      >
        {badgeName}
      </p>

      {/* Earned date */}
      {earned && formattedDate && (
        <p className="text-[10px] text-gray-500">
          {dateLabels[language]} {formattedDate}
        </p>
      )}
    </div>
  );
}
