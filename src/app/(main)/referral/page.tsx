"use client";

import { useEffect, useState } from "react";
import { Share2, Users, Gift, Copy, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import Link from "next/link";

interface ReferralData {
  referralCode: string;
  points: number;
  referralBonusPoints: number;
  referrals: any[];
}

export default function ReferralDashboard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/referral')
      .then(async (res) => {
        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || 'Referral ma\'lumotini olib bo\'lmadi');
        }
        return resData;
      })
      .then(resData => {
        if (resData.success) {
          setData(resData);
        }
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const referralLink = typeof window !== 'undefined' 
      ? `${window.location.origin}/register?ref=${data?.referralCode ?? ''}`
      : `https://pack24.uz/register?ref=${data?.referralCode ?? ''}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Havola nusxalandi!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-16 max-w-3xl mx-auto text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-emerald-700">Referral dasturi</h1>
        <p className="text-muted-foreground">{error}</p>
        <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 transition-colors text-sm">
          Tizimga kirish
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      
      {/* Header Section */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full mb-2 shadow-sm">
          <Share2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-400">
          Tarmog&apos;ingizni quring va ulush oling!
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
          Tabiatni asrashga hissa qo&apos;shish bilan birga, har bir taklif qilgan do&apos;stingiz (yoki maktabingiz) orqali yig&apos;ilgan makulatura hajmidan doimiy <b>Referal Eko-ballar</b> qo&apos;lga kiriting. Eko-ballarni cash yoki vaucherlarga almashtiring!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Main Action Card */}
        <div className="md:col-span-7 space-y-6">
          <Card className="border-emerald-200 shadow-lg bg-white overflow-hidden hover:shadow-xl transition-shadow">
            <CardHeader className="bg-emerald-50 border-b border-emerald-100 pb-6">
              <CardTitle className="text-xl text-emerald-800 font-bold">Sizning shaxsiy havolangiz</CardTitle>
              <CardDescription>Bu havolani do&apos;stlaringizga yuborib tizimga taklif qiling</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-2">
                <div className="bg-gray-100/80 p-4 rounded-xl w-full font-mono text-sm border border-gray-200 text-gray-600 truncate select-all">
                  {referralLink}
                </div>
                <Button 
                  onClick={copyToClipboard}
                  size="lg"
                  className={`${copied ? 'bg-green-500 hover:bg-green-600' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl px-6 h-[54px] shadow-sm w-full sm:w-auto transition-all`}
                >
                  {copied ? <CheckCircle2 className="mr-2 h-5 w-5" /> : <Copy className="mr-2 h-5 w-5" />}
                  {copied ? 'Nusxalandi' : 'Nusxa olish'}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-3xl font-black text-gray-800">{data?.referrals?.length || 0}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1 tracking-wider">Takliflar</div>
                </div>
                <div className="text-center border-l border-r border-gray-100">
                  <div className="text-3xl font-black text-emerald-600">{data?.referralBonusPoints || 0}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1 tracking-wider">Bonus ballar</div>
                </div>
                <div className="text-center flex flex-col items-center justify-center text-blue-600 font-medium bg-blue-50/50 rounded-lg py-2">
                  <TrendingUp className="h-5 w-5 mb-1 text-blue-500" />
                  <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">Aktiv Daromad</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-[2px] rounded-2xl shadow-md">
            <div className="bg-white rounded-[14px] p-6 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-emerald-900 mb-2">Qanday ishlaydi?</h3>
                <ol className="space-y-2.5 text-sm text-gray-600 font-medium">
                  <li className="flex gap-2 items-center"><div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">1</div> Havolani nusxalang va ulashing</li>
                  <li className="flex gap-2 items-center"><div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">2</div> Do&apos;stingiz tizimdan ro&apos;yxatdan o&apos;tadi</li>
                  <li className="flex gap-2 items-start"><div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">3</div> <span className="pt-0.5">U makulatura topshirganda qimmatli <span className="text-emerald-600 font-extrabold">Eko-ballar</span> doimiy sizga qo&apos;shilib boradi!</span></li>
                </ol>
              </div>
              <Gift className="w-24 h-24 text-emerald-50 hidden sm:block rotate-12 drop-shadow-sm" />
            </div>
          </div>
        </div>

        {/* Referrals List Card */}
        <div className="md:col-span-5">
          <Card className="h-full shadow-sm hover:shadow-md transition-shadow border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <CardTitle className="font-bold">Tarmoq hamkorlari</CardTitle>
              </div>
              <CardDescription>
                Sizning havolangiz orqali qo&apos;shilganlar jadvali
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {data?.referrals && data.referrals.length > 0 ? (
                <div className="space-y-3">
                  {data.referrals.map((ref: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-200 transition-colors group">
                      <div>
                        <p className="font-bold text-sm text-gray-800 group-hover:text-emerald-700 transition-colors">{ref.name}</p>
                        <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                          {new Date(ref.createdAt).toLocaleDateString('uz-UZ')} da qo&apos;shildi
                        </p>
                      </div>
                      <div className="bg-emerald-100/80 text-emerald-800 px-3 py-1 rounded-full text-xs font-black font-mono">
                        +{ref.ecoPoints || 5} ball
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4 bg-gray-50/50 rounded-xl border border-dashed border-gray-200 mt-2">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-bold text-gray-700">Hali hech kimni taklif qilmadingiz</p>
                  <p className="text-[13px] text-gray-500 mt-1 max-w-[200px]">Hozirzoq havolangizni ulashing va tarmog&apos;ingizni qurishni boshlang!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
