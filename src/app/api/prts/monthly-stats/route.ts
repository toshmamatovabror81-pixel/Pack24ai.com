import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PRTS — Oylik material statistikasi
 * 6 oylik RecycleRequest data ni material turlari bo'yicha aggregate qiladi
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const userId = Number(session?.user?.id);

        if (!Number.isFinite(userId)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // So'nggi 6 oylik ma'lumot
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const requests = await prisma.recycleRequest.findMany({
            where: {
                userId,
                createdAt: { gte: sixMonthsAgo },
                status: { in: ["completed", "confirmed", "collected"] },
            },
            select: {
                material: true,
                volume: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        // Material turlarini categoriyalash
        const materialMap: Record<string, string> = {
            "Gazeta va jurnallar": "qogoz",
            "Ofis qog'ozi (A4 va boshqa)": "qogoz",
            "Kitob va darsliklar": "qogoz",
            "Arxiv hujjatlar": "qogoz",
            "Karton va gofrokarton": "karton",
            "Qadoqlash qog'ozi": "karton",
            // Telegram bot uchun
            "qogoz": "qogoz",
            "karton": "karton",
            "gazeta": "qogoz",
            "jurnal": "qogoz",
            "ofis": "qogoz",
            "kitob": "qogoz",
            "aralash": "aralash",
        };

        // Oylar bo'yicha guruhlash
        const monthlyData: Record<string, { qogoz: number; karton: number; aralash: number }> = {};

        const monthNames = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

        for (const req of requests) {
            const date = new Date(req.createdAt);
            const key = `${monthNames[date.getMonth()]}`;

            if (!monthlyData[key]) {
                monthlyData[key] = { qogoz: 0, karton: 0, aralash: 0 };
            }

            const category = materialMap[req.material || ""] || "aralash";
            const volume = req.volume || 0;
            monthlyData[key][category as keyof typeof monthlyData[string]] += volume;
        }

        // Array formatga o'tkazish
        const chartData = Object.entries(monthlyData).map(([month, data]) => ({
            month,
            ...data,
        }));

        // Agar ma'lumot bo'sh bo'lsa, demo data
        if (chartData.length === 0) {
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now);
                d.setMonth(d.getMonth() - i);
                chartData.push({
                    month: monthNames[d.getMonth()],
                    qogoz: Math.floor(Math.random() * 40) + 5,
                    karton: Math.floor(Math.random() * 30) + 3,
                    aralash: Math.floor(Math.random() * 15) + 2,
                });
            }
        }

        return NextResponse.json({ chartData });
    } catch (error) {
        console.error("PRTS monthly-stats error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
