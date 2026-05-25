'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Loader2, MessageCircle, UserPlus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

type RegMode = 'telegram' | 'manual';

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { register } = useAuthStore();
    const [mode, setMode] = useState<RegMode>('telegram');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const referralCode = searchParams.get('ref');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const result = await register(name, phone, password, referralCode);
            if (result.success) {
                toast.success("Muvaffaqiyatli ro'yxatdan o'tdingiz!");
                router.push('/profile');
            } else {
                toast.error(result.error || "Ro'yxatdan o'tishda xatolik");
            }
        } catch {
            toast.error("Tizim xatosi");
        } finally {
            setIsLoading(false);
        }
    };

    const botUrl = referralCode
        ? `https://t.me/Pack24AI_bot?start=ref_${referralCode}`
        : 'https://t.me/Pack24AI_bot';

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-[#F9FAFB] p-4">
            <Card className="w-full max-w-md p-8 shadow-xl">

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-[#064E3B] flex items-center justify-center mx-auto mb-3">
                        <UserPlus size={24} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Ro&apos;yxatdan o&apos;tish</h1>
                    <p className="text-gray-500 text-sm mt-1">Pack24 hisobingizni yarating</p>
                </div>

                {/* Mode toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                    <button
                        onClick={() => setMode('telegram')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'telegram'
                                ? 'bg-white shadow text-[#064E3B]'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <MessageCircle size={15} />
                        Telegram orqali
                    </button>
                    <button
                        onClick={() => setMode('manual')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            mode === 'manual'
                                ? 'bg-white shadow text-[#064E3B]'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <UserPlus size={15} />
                        Parol bilan
                    </button>
                </div>

                {/* ── TELEGRAM MODE ──────────────────────────────────── */}
                {mode === 'telegram' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                                    <MessageCircle size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-blue-800 text-sm mb-1">Telegram bot orqali ro&apos;yxatdan o&apos;ting</p>
                                    <p className="text-blue-600 text-xs leading-relaxed">
                                        Eng qulay usul — bot orqali telefon raqamingizni tasdiqlab hisob yarating.
                                        Kirish kodi Telegram&apos;ga yuboriladi.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {[
                                { num: '1', text: '@Pack24AI_bot ga o\'ting' },
                                { num: '2', text: '/start ni bosing' },
                                { num: '3', text: 'Telefon raqamingizni ulashing' },
                                { num: '4', text: 'Tasdiqlash kodini kiriting' },
                                { num: '5', text: 'Ismingizni yozing → tayyor!' },
                            ].map(step => (
                                <div key={step.num} className="flex items-center gap-3">
                                    <span className="w-7 h-7 rounded-full bg-[#064E3B] text-white text-xs font-bold flex items-center justify-center shrink-0">
                                        {step.num}
                                    </span>
                                    <span className="text-sm text-gray-700">{step.text}</span>
                                </div>
                            ))}
                        </div>

                        <a
                            href={botUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full bg-[#064E3B] hover:bg-[#053d2e] text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            <MessageCircle size={18} />
                            @Pack24AI_bot ga o&apos;tish
                            <ExternalLink size={14} />
                        </a>

                        <p className="text-center text-xs text-gray-400">
                            Bot orqali ro&apos;yxatdan o&apos;tgach, saytga{' '}
                            <Link href="/login" className="text-[#064E3B] font-semibold hover:underline">
                                Telegram kodi
                            </Link>{' '}
                            bilan kiring.
                        </p>
                    </div>
                )}

                {/* ── MANUAL MODE ────────────────────────────────────── */}
                {mode === 'manual' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <Input
                            label="Ismingiz"
                            placeholder="Ism Familiya"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                        <Input
                            label="Telefon raqami"
                            type="tel"
                            placeholder="+998 90 123 45 67"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                        <Input
                            label="Parol"
                            type="password"
                            placeholder="Kamida 8 belgi"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <Button
                            type="submit"
                            className="w-full bg-[#064E3B] hover:bg-[#053d2e] h-11 text-base"
                            disabled={isLoading}
                        >
                            {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                            Ro&apos;yxatdan o&apos;tish
                        </Button>
                    </form>
                )}

                <div className="mt-5 pt-4 border-t border-gray-100 text-center text-sm">
                    <span className="text-gray-500">Allaqachon hisobingiz bormi? </span>
                    <Link href="/login" className="text-[#064E3B] font-semibold hover:underline">
                        Kirish
                    </Link>
                </div>
            </Card>
        </div>
    );
}
