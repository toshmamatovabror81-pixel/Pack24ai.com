'use client';

import React, { useEffect, useState } from 'react';
import { Leaf, Zap, TrendingUp, Sparkles } from 'lucide-react';
import { getLevelByWeight, levelProgress, kgToNextLevel, type EcoLevel } from '@/lib/eco/levels';

interface EcoStatusCardProps {
  ecoLevel: string;
  ecoPoints: number;
  totalKg: number;
  language?: 'uz' | 'ru';
}

const labels = {
  uz: {
    level: 'Daraja',
    points: 'Eko ballar',
    recycled: 'Qayta ishlangan',
    nextLevel: 'Keyingi daraja',
    remaining: 'qoldi',
    maxLevel: 'Maksimal daraja!',
    kg: 'kg',
  },
  ru: {
    level: 'Уровень',
    points: 'Эко-баллы',
    recycled: 'Переработано',
    nextLevel: 'Следующий уровень',
    remaining: 'осталось',
    maxLevel: 'Максимальный уровень!',
    kg: 'кг',
  },
};

export default function EcoStatusCard({
  ecoLevel,
  ecoPoints,
  totalKg,
  language = 'uz',
}: EcoStatusCardProps) {
  const t = labels[language];
  const level = getLevelByWeight(totalKg);
  const progress = levelProgress(totalKg);
  const remaining = kgToNextLevel(totalKg);

  // Animated progress bar
  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  // Animated counter
  const [displayKg, setDisplayKg] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const steps = 40;
    const increment = totalKg / steps;
    let current = 0;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      current = Math.min(totalKg, Math.round(increment * step));
      setDisplayKg(current);
      if (step >= steps) clearInterval(interval);
    }, duration / steps);
    return () => clearInterval(interval);
  }, [totalKg]);

  const levelName = language === 'ru' ? level.nameRu : level.nameUz;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-[1px]"
      style={{
        background: `linear-gradient(135deg, ${level.color}88, ${level.color}44, ${level.color}22)`,
      }}
    >
      {/* Outer glow */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-30 blur-xl"
        style={{ background: level.color }}
      />

      <div className="relative rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 p-6">
        {/* Background decoration */}
        <div
          className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full opacity-[0.07] blur-3xl"
          style={{ background: level.color }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full opacity-[0.05] blur-2xl"
          style={{ background: level.color }}
        />

        {/* Header: Level info */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-3xl shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${level.color}30, ${level.color}15)`,
                boxShadow: `0 0 20px ${level.color}25`,
              }}
            >
              {level.emoji}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                {t.level}
              </p>
              <h3
                className="text-xl font-bold"
                style={{ color: level.color }}
              >
                {levelName}
              </h3>
            </div>
          </div>

          {/* Eco Points pill */}
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{
              background: `${level.color}18`,
              color: level.color,
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>{ecoPoints.toLocaleString()}</span>
          </div>
        </div>

        {/* Big KG number */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-extrabold tabular-nums tracking-tight"
              style={{ color: level.color }}
            >
              {displayKg.toLocaleString()}
            </span>
            <span className="text-lg font-medium text-gray-500">{t.kg}</span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-400">
            <TrendingUp className="h-3.5 w-3.5" />
            {t.recycled}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-400">
              {t.nextLevel}
            </span>
            <span className="font-semibold" style={{ color: level.color }}>
              {animatedProgress}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${animatedProgress}%`,
                background: `linear-gradient(90deg, ${level.color}CC, ${level.color})`,
                boxShadow: `0 0 12px ${level.color}60`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {remaining !== null ? (
              <>
                <span className="font-semibold" style={{ color: level.color }}>
                  {remaining.toLocaleString()} {t.kg}
                </span>{' '}
                {t.remaining}
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" style={{ color: level.color }} />
                {t.maxLevel}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
