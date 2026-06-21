/**
 * POST /api/ai/semantic-search
 * Gemini Embedding yordamida mahsulotlar bo'yicha semantik qidiruv
 * ─────────────────────────────────────────────────────────────
 * Foydalanuvchi savolini embedding ga o'girib, knowledge base va
 * mahsulotlar ro'yxati bilan cosine similarity orqali solishtiradi.
 * 
 * pgvector KERAK EMAS — barcha embedding'lar runtime da yaratiladi.
 */
import { NextRequest, NextResponse } from 'next/server';
import { KNOWLEDGE_BASE } from '@/lib/ai-knowledge';
import { rateLimit, getClientIp, getRateLimitResponse } from '@/lib/rateLimit';

// ─── Rate Limiter ────────────────────────────────────────────
const semanticSearchLimiter = rateLimit({ windowMs: 60_000, max: 20 });

// ─── Types ────────────────────────────────────────────────────
interface SearchResult {
    id: string;
    title: string;
    content: string;
    score: number;
    type: 'knowledge' | 'product';
}

// ─── In-memory embedding cache ───────────────────────────────
const embeddingCache = new Map<string, number[]>();

// ─── Cosine Similarity ───────────────────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ─── Get Embedding from Gemini ──────────────────────────────
async function getEmbedding(text: string): Promise<number[]> {
    const cached = embeddingCache.get(text);
    if (cached) return cached;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey || apiKey.length < 10) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const result = await ai.models.embedContent({
        model: 'gemini-embedding-001',
        contents: text,
    });

    const embedding = result.embeddings?.[0]?.values;
    if (!embedding) throw new Error('No embedding returned');

    // Cache for reuse
    embeddingCache.set(text, embedding);
    return embedding;
}

// ─── Build searchable documents from Knowledge Base ─────────
function buildDocuments(language: string): Array<{ id: string; title: string; content: string; type: 'knowledge' | 'product' }> {
    return KNOWLEDGE_BASE.map(article => {
        const response = (article.responses as Record<string, string>)[language]
            ?? (article.responses as Record<string, string>)['uz']
            ?? '';

        const keywords = (article.keywords as Record<string, string[]>)[language]
            ?? (article.keywords as Record<string, string[]>)['uz']
            ?? [];

        return {
            id: article.id,
            title: article.id.replace(/_/g, ' ').toUpperCase(),
            content: `${keywords.join(', ')}. ${response}`,
            type: 'knowledge' as const,
        };
    });
}

export async function POST(req: NextRequest) {
    try {
        // Rate limiting
        const ip = getClientIp(req);
        const rl = semanticSearchLimiter.check(`ai-semantic-search:${ip}`);
        if (!rl.allowed) return getRateLimitResponse(rl.retryAfterMs);

        const { query, language = 'uz', topK = 5 } = await req.json();

        if (!query || typeof query !== 'string' || query.trim().length < 2) {
            return NextResponse.json({ error: 'Query kerak (min 2 belgi)' }, { status: 400 });
        }

        if (query.trim().length > 500) {
            return NextResponse.json({ error: 'Query juda uzun (max 500 belgi)' }, { status: 400 });
        }

        // Validate topK: must be between 1 and 10
        const validTopK = Math.max(1, Math.min(10, Number(topK) || 5));

        const sanitizedQuery = query.trim().slice(0, 200);

        // Build documents
        const documents = buildDocuments(language);

        // Get query embedding
        const queryEmbedding = await getEmbedding(sanitizedQuery);

        // Get embeddings for all documents and calculate similarity
        const scoredResults: SearchResult[] = [];

        for (const doc of documents) {
            try {
                const docEmbedding = await getEmbedding(doc.content.slice(0, 500));
                const score = cosineSimilarity(queryEmbedding, docEmbedding);
                scoredResults.push({
                    id: doc.id,
                    title: doc.title,
                    content: doc.content.slice(0, 300),
                    score: Math.round(score * 1000) / 1000,
                    type: doc.type,
                });
            } catch {
                // Skip docs that fail to embed
            }
        }

        // Sort by similarity score, return top K
        scoredResults.sort((a, b) => b.score - a.score);
        const topResults = scoredResults.slice(0, validTopK);

        return NextResponse.json({
            query: sanitizedQuery,
            results: topResults,
            total: scoredResults.length,
            model: 'text-embedding-004',
        });
    } catch (error) {
        console.error('[Semantic Search]', error);
        const msg = error instanceof Error ? error.message : 'Server xatosi';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
