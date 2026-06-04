"use client";

import { useEffect, useState } from "react";
import { Share2, Users, Gift, Copy, CheckCircle2, Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import Link from "next/link";

interface ReferralPerson {
  id: number;
  name: string;
  createdAt: string;
  ecoPoints?: number;
}

interface TreeNode extends ReferralPerson {
  children?: TreeNode[];
}

interface LevelData {
  count: number;
  points: number;
  referrals: ReferralPerson[];
}

interface ReferralData {
  referralCode: string;
  points: number;
  levels: {
    level1: LevelData;
    level2: LevelData;
    level3: LevelData;
  };
  totalChainSize: number;
  isEcoAmbassador: boolean;
  totalBonusPoints: number;
  tree: TreeNode[];
}

type ActiveTab = "all" | "level1" | "level2" | "level3";

/* ─── Tree Visualization ─── */
function ReferralTree({ tree }: { tree: TreeNode[] }) {
  const [expanded, setExpanded] = useState(true);

  if (tree.length === 0) return null;

  return (
    <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
      <CardHeader className="bg-gray-50/50 border-b border-gray-100 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-emerald-600" />
            <CardTitle className="font-bold">Tarmoq daraxti</CardTitle>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
        <CardDescription>Sizning referal zanjiringiz vizualizatsiyasi</CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-4">
          <div className="font-mono text-sm space-y-0.5 overflow-x-auto">
            <div className="font-bold text-emerald-700 flex items-center gap-1">
              <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs flex items-center justify-center font-bold">👤</span>
              Siz
            </div>
            {tree.map((node, i) => (
              <TreeBranch
                key={node.id}
                node={node}
                isLast={i === tree.length - 1}
                prefix=""
                level={1}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function TreeBranch({ node, isLast, prefix, level }: { node: TreeNode; isLast: boolean; prefix: string; level: number }) {
  const connector = isLast ? "└── " : "├── ";
  const childPrefix = prefix + (isLast ? "    " : "│   ");

  const levelColors: Record<number, string> = {
    1: "text-emerald-700 bg-emerald-50",
    2: "text-blue-700 bg-blue-50",
    3: "text-purple-700 bg-purple-50",
  };
  const levelEmoji: Record<number, string> = { 1: "🟢", 2: "🔵", 3: "🟣" };
  const colorClass = levelColors[level] || "text-gray-700 bg-gray-50";

  const children = node.children ?? [];

  return (
    <>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-gray-400 select-none">{prefix}{connector}</span>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${colorClass}`}>
          {levelEmoji[level]} {node.name || "Foydalanuvchi"}
        </span>
      </div>
      {children.map((child, i) => (
        <TreeBranch
          key={child.id}
          node={child}
          isLast={i === children.length - 1}
          prefix={childPrefix}
          level={level + 1}
        />
      ))}
    </>
  );
}

/* ─── Main Page ─── */
export default function ReferralDashboard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");

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

  const levels = data?.levels;
  const allReferrals: (ReferralPerson & { level: number })[] = [
    ...(levels?.level1.referrals.map(r => ({ ...r, level: 1 })) ?? []),
    ...(levels?.level2.referrals.map(r => ({ ...r, level: 2 })) ?? []),
    ...(levels?.level3.referrals.map(r => ({ ...r, level: 3 })) ?? []),
  ];

  const filteredReferrals = activeTab === "all"
    ? allReferrals
    : allReferrals.filter(r => r.level === Number(activeTab.replace("level", "")));

  const levelConfig = [
    { key: "level1" as const, emoji: "🟢", label: "Direct", sublabel: "500 ball/kishi", color: "emerald", data: levels?.level1 },
    { key: "level2" as const, emoji: "🔵", label: "Ikkinchi daraja", sublabel: "200 ball/kishi", color: "blue", data: levels?.level2 },
    { key: "level3" as const, emoji: "🟣", label: "Uchinchi daraja", sublabel: "100 ball/kishi", color: "purple", data: levels?.level3 },
  ];

  const colorMap: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", lightBg: "bg-emerald-100/80" },
    blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", lightBg: "bg-blue-100/80" },
    purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", lightBg: "bg-purple-100/80" },
  };

  const levelBadgeClass: Record<number, string> = {
    1: "bg-emerald-100/80 text-emerald-800",
    2: "bg-blue-100/80 text-blue-800",
    3: "bg-purple-100/80 text-purple-800",
  };

  const levelLabel: Record<number, string> = { 1: "Daraja 1", 2: "Daraja 2", 3: "Daraja 3" };

  return (
    <div className="container py-8 max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      
      {/* Header Section */}
      <div className="text-center space-y-4 mb-10">
        <div className="inline-flex items-center justify-center p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-full mb-2 shadow-sm">
          <Share2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-400">
          Yashil Zanjir — Tarmog&apos;ingizni quring!
        </h1>
        <p className="max-w-2xl mx-auto text-lg text-muted-foreground">
          3 darajali referal tizimi orqali do&apos;stlaringizni taklif qiling, ular ham boshqalarni taklif qilsin — har bir daraja uchun <b>Eko-ballar</b> qo&apos;lga kiriting!
        </p>
      </div>

      {/* Eco Ambassador Badge */}
      {data?.isEcoAmbassador && (
        <div className="flex justify-center animate-in slide-in-from-top duration-700">
          <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl px-6 py-3 shadow-md">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="font-extrabold text-amber-800 text-sm">🏆 Eco Ambassador</p>
              <p className="text-xs text-amber-600">Siz {data.totalChainSize} kishilik zanjir qurdingiz!</p>
            </div>
          </div>
        </div>
      )}

      {/* 3-Level Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {levelConfig.map(({ key, emoji, label, sublabel, color, data: levelData }) => {
          const c = colorMap[color];
          return (
            <Card key={key} className={`${c.border} shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{emoji}</span>
                  <div>
                    <p className={`font-bold text-sm ${c.text}`}>{label}</p>
                    <p className="text-[11px] text-muted-foreground">{sublabel}</p>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-black text-gray-800">{levelData?.count ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">kishi</p>
                  </div>
                  <div className={`${c.lightBg} ${c.text} px-3 py-1.5 rounded-full text-xs font-black font-mono`}>
                    +{levelData?.points ?? 0} ball
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total bonus summary */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Gift className="w-8 h-8 text-emerald-100" />
          <div>
            <p className="font-extrabold text-lg">Jami referal ballari</p>
            <p className="text-emerald-100 text-sm">Barcha 3 daraja bo&apos;yicha</p>
          </div>
        </div>
        <div className="text-4xl font-black">{data?.totalBonusPoints ?? 0} <span className="text-lg font-bold text-emerald-200">ball</span></div>
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
                  <div className="text-3xl font-black text-gray-800">{data?.totalChainSize ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1 tracking-wider">Jami zanjir</div>
                </div>
                <div className="text-center border-l border-r border-gray-100">
                  <div className="text-3xl font-black text-emerald-600">{data?.totalBonusPoints ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1 tracking-wider">Bonus ballar</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-blue-600">3</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold mt-1 tracking-wider">Daraja</div>
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
                  <li className="flex gap-2 items-start"><div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">3</div> <span className="pt-0.5">U ham do&apos;stlarini taklif qilsa — 3 darajagacha <span className="text-emerald-600 font-extrabold">Eko-ballar</span> doimiy sizga tushadi!</span></li>
                </ol>
              </div>
              <Gift className="w-24 h-24 text-emerald-50 hidden sm:block rotate-12 drop-shadow-sm" />
            </div>
          </div>
        </div>

        {/* Referrals List Card with Tabs */}
        <div className="md:col-span-5">
          <Card className="h-full shadow-sm hover:shadow-md transition-shadow border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <CardTitle className="font-bold">Tarmoq hamkorlari</CardTitle>
              </div>
              <CardDescription>
                Sizning zanjiringiz orqali qo&apos;shilganlar
              </CardDescription>
              {/* Tab buttons */}
              <div className="flex gap-1 pt-3 flex-wrap">
                {([
                  { key: "all" as const, label: "Barchasi", count: allReferrals.length },
                  { key: "level1" as const, label: "🟢 D1", count: levels?.level1.count ?? 0 },
                  { key: "level2" as const, label: "🔵 D2", count: levels?.level2.count ?? 0 },
                  { key: "level3" as const, label: "🟣 D3", count: levels?.level3.count ?? 0 },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      activeTab === tab.key
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {filteredReferrals.length > 0 ? (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredReferrals.map((ref) => (
                    <div key={`${ref.level}-${ref.id}`} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-emerald-200 transition-colors group">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-gray-800 group-hover:text-emerald-700 transition-colors">{ref.name || "Foydalanuvchi"}</p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${levelBadgeClass[ref.level]}`}>
                            {levelLabel[ref.level]}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                          {new Date(ref.createdAt).toLocaleDateString('uz-UZ')} da qo&apos;shildi
                        </p>
                      </div>
                      <div className={`${levelBadgeClass[ref.level]} px-3 py-1 rounded-full text-xs font-black font-mono`}>
                        +{ref.level === 1 ? 500 : ref.level === 2 ? 200 : 100} ball
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

      {/* Tree Visualization */}
      {data?.tree && data.tree.length > 0 && (
        <ReferralTree tree={data.tree} />
      )}
    </div>
  );
}
