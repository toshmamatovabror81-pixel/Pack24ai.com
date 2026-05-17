import { useState, useCallback } from 'react';
import { Language } from '../translations';
import { BoxModel, BoxDimensions, Material } from '../types';

interface AIContext {
    model?: BoxModel;
    dims?: BoxDimensions;
    totalPrice?: number;
    unitPrice?: number;
    language: Language;
    quantity?: number;
    material?: Material;
}

export function useAI() {
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateResponse = useCallback(
        async (userMessage: string, context: AIContext): Promise<string> => {
            setIsTyping(true);
            setError(null);

            try {
                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userMessage,
                        language: context.language,
                        context: {
                            modelName: context.model?.name,
                            quantity: context.quantity,
                            totalPrice: context.totalPrice,
                            unitPrice: context.unitPrice,
                            material: context.material?.name,
                            dims: context.dims
                                ? {
                                      l: context.dims.l,
                                      w: context.dims.w,
                                      h: context.dims.h,
                                  }
                                : undefined,
                        },
                    }),
                });

                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const data = await res.json();
                return data.content ?? "Kechirasiz, javob olishda xato yuz berdi.";
            } catch (err) {
                const msg =
                    context.language === 'ru'
                        ? 'Ошибка соединения. Попробуйте снова.'
                        : context.language === 'en'
                        ? 'Connection error. Please try again.'
                        : "Ulanish xatosi. Iltimos, qayta urinib ko'ring.";
                setError(msg);
                return msg;
            } finally {
                setIsTyping(false);
            }
        },
        []
    );

    return {
        generateResponse,
        isTyping,
        error,
    };
}
