"use client";

import { useEffect, useState } from "react";
import { Trees, Droplets, CloudFog, Trophy, Leaf, Zap, History, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

interface EcoRecentRequest {
    id: string | number;
    material?: string;
    createdAt: string;
    pointId?: string | null;
    volume?: number;
    status: string;
}

interface EcoStats {
  points: number;
  totalWeight: number;
  treesSaved: string;
  co2Offset: string;
  waterSaved: string;
  recentRequests: EcoRecentRequest[];
}

export default function EcoDashboard() {
  const [stats, setStats] = useState<EcoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/eco/stats')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Eco statistika vaqtincha mavjud emas');
        }
        return data;
      })
      .then(data => {
        setStats(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Leaf className="h-8 w-8 animate-bounce text-emerald-500" />
          <p className="text-sm text-muted-foreground">Eco natijalar yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16 max-w-3xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-emerald-700">
          Sizning Eko-Hisobotingiz
        </h1>
        <p className="text-muted-foreground">{error}</p>
        <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 transition-colors text-sm">
          Tizimga kirish
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-emerald-700 dark:text-emerald-400">
            Sizning Eko-Hisobotingiz
          </h1>
          <p className="text-muted-foreground mt-1">
            Tabiatni asrashga qo&apos;shayotgan hissangiz uchun rahmat! Tizim orqali to&apos;plagan ballaringiz va natijalaringiz bilan tanishing.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-full border border-emerald-100 dark:border-emerald-900/50">
          <Trophy className="h-5 w-5 text-amber-500 hover:scale-110 transition-transform" />
          <span className="font-semibold text-emerald-900 dark:text-emerald-300">
            {stats?.points || 0} Eko Ball
          </span>
        </div>
      </div>

      {/* Main KPI Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background dark:border-emerald-900/30 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              Jami topshirilgan
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
              <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {stats?.totalWeight || 0} <span className="text-base font-normal text-muted-foreground">kg</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-100 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background dark:border-green-900/30 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">
              Daraxtlar saqlandi
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
              <Trees className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {stats?.treesSaved || "0"} <span className="text-base font-normal text-muted-foreground">ta</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background dark:border-blue-900/30 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">
              CO2 miqdori qisqardi
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <CloudFog className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {stats?.co2Offset || "0"} <span className="text-base font-normal text-muted-foreground">kg</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-100 bg-gradient-to-br from-cyan-50 to-white dark:from-cyan-950/20 dark:to-background dark:border-cyan-900/30 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-800 dark:text-cyan-300">
              Suv hajmi tejaldi
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
              {stats?.waterSaved || "0"} <span className="text-base font-normal text-muted-foreground">litr</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gamification / Banner Section */}
      <div className="relative overflow-hidden rounded-2xl bg-emerald-600 px-6 py-10 shadow-lg sm:px-12 sm:py-16 transform transition hover:scale-[1.01]">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <Leaf className="h-14 w-14 text-emerald-200 mb-4 animate-[spin_10s_linear_infinite]" />
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Siz tabiat qutqaruvchisiz!
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-emerald-100">
            Har gal makulatura topshirganingizda siz nafaqat o&apos;rmonlarimizni asrab qolmoqdasiz, balki atrof-muhit musaffoligiga katta hissa qo&apos;shmoqdasiz. Buning uchun tizim qoidalariga ko&apos;ra Eko-ballar bilan taqdirlanasiz! 
          </p>
          <div className="mt-8 flex gap-4 flex-wrap justify-center">
            <Button variant="secondary" size="lg" className="rounded-full shadow-md font-semibold text-emerald-800 hover:bg-emerald-50">
              Makulatura topshirish
            </Button>
            <Button variant="outline" size="lg" className="rounded-full border-emerald-200 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2">
              <Trophy className="w-4 h-4" /> Ballarni almashtirish
            </Button>
          </div>
        </div>
      </div>

      {/* Leaderboard Link Card */}
      <Link href="/eco-dashboard/leaderboard" className="block group">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-emerald-50 to-teal-50 dark:from-amber-950/20 dark:via-emerald-950/20 dark:to-teal-950/20 border border-emerald-200 dark:border-emerald-800/40 px-6 py-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/50 group-hover:scale-110 transition-transform">
                <Trophy className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  🏆 Shaharlar Yashil Reytingi
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Sizning shahringiz qaysi o&apos;rinda? Ko&apos;ring va raqobatda g&apos;olib bo&apos;ling!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Ko&apos;rish
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>

      {/* Virtual Forest Link Card */}
      <Link href="/eco-dashboard/forest" className="block group">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-50 via-green-50 to-lime-50 dark:from-emerald-950/20 dark:via-green-950/20 dark:to-lime-950/20 border border-green-200 dark:border-green-800/40 px-6 py-6 shadow-sm transition-all hover:shadow-lg hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200/50 dark:shadow-green-900/50 group-hover:scale-110 transition-transform">
                <Trees className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  🌳 Virtual O&apos;rmoningiz
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Qayta ishlash ta&apos;siringizni 3D o&apos;rmonda ko&apos;ring
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              Ko&apos;rish
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>

      {stats?.recentRequests && stats.recentRequests.length > 0 && (
        <Card className="shadow-sm border-emerald-100">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600" />
              <CardTitle>So&apos;nggi faolliklaringiz</CardTitle>
            </div>
            <CardDescription>
              Yaqin orada topshirgan makulatura arizalaringiz va ishlagan ballaringiz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0 hover:bg-muted/50 p-2 rounded-lg transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-sm text-foreground">
                      {req.material || "Aralash makulatura"} 
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {new Date(req.createdAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                      &bull;
                      {req.pointId ? "Hudud id: " + req.pointId : "Mijoz xizmati"}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-emerald-600">
                      +{req.volume || 0} kg
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
