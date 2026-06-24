'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { useCategoryStore } from '@/lib/store/useCategoryStore';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { useRealtimeEvents, type RealtimeEvent } from '@/lib/hooks/useRealtimeEvents';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';
import AdminCallPopup from '@/components/admin/AdminCallPopup';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const hasMounted = useHasMounted();
    const router = useRouter();
    const pathname = usePathname();
    const isLoginPage = pathname === '/admin/login';

    // ── Auth Guard: admin token tekshiruvi ────────────────────────────
    const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

    useEffect(() => {
        // Login sahifasida tekshirish shart emas
        if (isLoginPage) {
            setIsAuthed(true);
            return;
        }

        // Cookie mavjudligini tezkor tekshirish
        const hasToken = document.cookie
            .split(';')
            .some(c => c.trim().startsWith('admin_auth='));

        if (!hasToken) {
            router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
            return;
        }

        // Token HMAC validatsiyasi — server-side tekshiruv
        fetch('/api/admin/me', { credentials: 'include' })
            .then(res => {
                if (res.ok) {
                    setIsAuthed(true);
                } else {
                    router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
                }
            })
            .catch(() => {
                router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
            });
    }, [pathname, router, isLoginPage]);

    // Rehydrate stores if needed (for skipHydration: true)
    useEffect(() => {
        useCategoryStore.persist.rehydrate();
    }, []);

    const [newOrdersCount, setNewOrdersCount] = useState(0);
    const [lastChecked, setLastChecked] = useState(new Date().toISOString());

    // Fixed type to include all used properties
    const [incomingCall, setIncomingCall] = useState<{
        name: string;
        phone: string;
        avatar: string;
        lastOrder: string;
    } | null>(null);

    // ── Real-time SSE: botlardan kelgan eventlar ──────────────────────────
    const SEVERITY_ICONS: Record<string, string> = {
        success: '✅', warning: '⚠️', error: '🚨', info: 'ℹ️',
    };

    const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
        if (event.type === 'support.call') {
            // Support.call eventini ushlab popupga chiqarish
            setIncomingCall({
                name: event.callerName || 'Mijoz',
                phone: event.callerPhone || '+998 ** *** ** **',
                avatar: (event.callerName || 'M')[0].toUpperCase(),
                lastOrder: 'Hozirgi chaqiruv',
            });
            // Ovozli bildirishnoma ham chalish mumkin
        } else {
            const icon = SEVERITY_ICONS[event.severity] || 'ℹ️';
            toast(`${icon} ${event.title}`, {
                description: event.message,
                duration: event.severity === 'error' ? 8000 : 5000,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { connected } = useRealtimeEvents(handleRealtimeEvent);

    // ── Polling: yangi buyurtmalar har 30 sekundda ────────────────────────
    useEffect(() => {
        let active = true;
        const poll = async () => {
            try {
                const res = await fetch(`/api/admin/notifications?since=${lastChecked}`);
                if (!res.ok || !active) return;
                const data = await res.json();
                if (data.newOrdersCount > newOrdersCount) {
                    toast(`🔔 ${data.newOrdersCount - newOrdersCount} ta yangi buyurtma!`, { duration: 4000 });
                }
                setNewOrdersCount(data.newOrdersCount ?? 0);
                setLastChecked(data.timestamp ?? new Date().toISOString());
            } catch { /* silent fail */ }
        };
        poll();
        // Dev: Neon DB kechikishi — polling kamroq (60s). Prod: 30s.
        const pollMs = process.env.NODE_ENV === 'development' ? 60_000 : 30_000;
        const interval = setInterval(poll, pollMs);
        return () => { active = false; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Login sahifasida sidebar va header ko'rsatmaslik
    if (isLoginPage) {
        return <>{children}</>;
    }

    if (!hasMounted || isAuthed === null) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Tizim yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    const handleLogout = async () => {
        try {
            await fetch('/api/admin/logout', {
                method: 'POST',
            });
        } catch {
            // UI logout should continue even if the request fails.
        } finally {
            localStorage.removeItem('admin_auth');
            router.push('/admin/login');
            router.refresh();
        }
    };

    const handleAnswerCall = () => {
        toast.success("Qo'ng'iroq qabul qilindi");
        setIncomingCall(null);
    };

    const handleDeclineCall = () => {
        setIncomingCall(null);
    };

    return (
        <div className="min-h-screen bg-[#f3f4f6] dark:bg-slate-900 flex font-sans text-slate-900 dark:text-slate-100 transition-colors">
            {/* Fixed Sidebar */}
            <AdminSidebar onLogout={handleLogout} />

            {/* Main Content Area (Offset by Sidebar width) */}
            <div className="flex-1 flex flex-col min-w-0 ml-[260px] bg-[#f8fafc] dark:bg-slate-950 transition-colors">
                {/* Clean Header */}
                <AdminHeader newOrdersCount={newOrdersCount} />

                {/* Page Content */}
                <main className="flex-1 p-8 overflow-y-auto">
                    <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {children}
                    </div>
                </main>
            </div>

            {/* Incoming Call Popup */}
            {incomingCall && (
                <AdminCallPopup
                    call={incomingCall}
                    onAnswer={handleAnswerCall}
                    onDecline={handleDeclineCall}
                />
            )}

            {/* SSE Connection Indicator */}
            <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-sm transition-all ${
                connected 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {connected ? 'LIVE' : 'OFFLINE'}
            </div>

            <Toaster position="top-right" expand={true} richColors />
        </div>
    );
}
