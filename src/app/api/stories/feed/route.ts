/**
 * GET /api/stories/feed
 *
 * Barcha faol (muddati o'tmagan) story'larni foydalanuvchilar bo'yicha guruhlab qaytaradi.
 * Public endpoint — auth ixtiyoriy. Agar auth bo'lsa, har bir story uchun
 * `hasViewed` flag qo'shiladi va ko'rilmagan story'li foydalanuvchilar birinchi turadi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/auth/verifyMobileToken';

export const dynamic = 'force-dynamic';

type StoryItem = {
    id: number;
    mediaUrl: string;
    mediaType: string;
    caption: string | null;
    textOverlay: unknown;
    viewCount: number;
    createdAt: Date;
    hasViewed?: boolean;
};

type UserStoryGroup = {
    userId: number;
    userName: string;
    userAvatar: string | null;
    stories: StoryItem[];
    hasUnseen: boolean;
};

export async function GET(req: NextRequest) {
    try {
        // Auth — ixtiyoriy
        const authHeader = req.headers.get('authorization');
        let currentUserId: number | null = null;

        if (authHeader) {
            const result = await verifyMobileToken(authHeader);
            if (result.ok) {
                currentUserId = result.userId;
            }
        }

        const now = new Date();

        // Faol story'larni olish (muddati o'tmagan)
        const stories = await prisma.story.findMany({
            where: {
                expiresAt: { gt: now },
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                userId: true,
                mediaUrl: true,
                mediaType: true,
                caption: true,
                textOverlay: true,
                viewCount: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                // Agar auth bo'lsa, ko'rganligini tekshirish uchun views'ni olish
                ...(currentUserId
                    ? {
                          views: {
                              where: { viewerId: currentUserId },
                              select: { id: true },
                              take: 1,
                          },
                      }
                    : {}),
            },
        });

        // Foydalanuvchi bo'yicha guruhlab olish
        const groupMap = new Map<number, UserStoryGroup>();

        for (const story of stories) {
            const hasViewed = currentUserId
                ? (story as typeof story & { views?: { id: number }[] }).views?.length > 0
                : undefined;

            const storyItem: StoryItem = {
                id: story.id,
                mediaUrl: story.mediaUrl,
                mediaType: story.mediaType,
                caption: story.caption,
                textOverlay: story.textOverlay,
                viewCount: story.viewCount,
                createdAt: story.createdAt,
                ...(currentUserId !== null ? { hasViewed: !!hasViewed } : {}),
            };

            if (groupMap.has(story.userId)) {
                const group = groupMap.get(story.userId)!;
                group.stories.push(storyItem);
                if (!hasViewed) {
                    group.hasUnseen = true;
                }
            } else {
                groupMap.set(story.userId, {
                    userId: story.user.id,
                    userName: story.user.name,
                    userAvatar: null,
                    stories: [storyItem],
                    hasUnseen: currentUserId !== null ? !hasViewed : true,
                });
            }
        }

        // Natija massivi
        const feed = Array.from(groupMap.values());

        // Saralash: ko'rilmagan story'li foydalanuvchilar birinchi,
        // keyin eng yangi story vaqti bo'yicha
        feed.sort((a, b) => {
            if (a.hasUnseen !== b.hasUnseen) {
                return a.hasUnseen ? -1 : 1;
            }
            const aLatest = a.stories[0]?.createdAt ?? new Date(0);
            const bLatest = b.stories[0]?.createdAt ?? new Date(0);
            return new Date(bLatest).getTime() - new Date(aLatest).getTime();
        });

        return NextResponse.json(feed);
    } catch (error) {
        console.error('[Stories Feed GET]:', error);
        return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
    }
}
