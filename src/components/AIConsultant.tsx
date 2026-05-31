"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, X } from 'lucide-react';
import { useLanguage } from '../lib/contexts/LanguageContext';
import { useAI } from '../lib/hooks/useAI';
import { BoxModel, BoxDimensions, Material } from '../lib/types';
import Mini3DViewer from './Mini3DViewer';
import ExternalModelViewer from './ExternalModelViewer';

type Message = {
    id: number;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
    inlineData?: { data: string; mimeType: string };
};

interface AIConsultantProps {
    model?: BoxModel;
    dims?: BoxDimensions;
    totalPrice?: number;
    unitPrice?: number;
    material?: Material;
    quantity?: number;
}

const WELCOME: Record<string, string> = {
    uz: 'Assalomu alaykum! 👋 Men Pack24 AI maslahatchisiman.\n\nSavol bering yoki quyidagi mavzulardan birini tanlang:',
    ru: 'Здравствуйте! 👋 Я AI-консультант Pack24.\n\nЗадайте вопрос или выберите тему ниже:',
    en: 'Hello! 👋 I am Pack24 AI Assistant.\n\nAsk a question or choose a topic below:',
    qr: 'Assalawma áleykum! 👋 Men Pack24 AI másláhátshisimen.\n\nSoraw beriń yaki taqırıp tańlań:',
    zh: '你好！👋 我是Pack24 AI助手。\n\n请提问或选择以下主题：',
    tr: 'Merhaba! 👋 Ben Pack24 AI Danışmanıyım.\n\nSoru sorun veya konu seçin:',
    tg: 'Ассалому алайкум! 👋 Ман маслаҳатчии Pack24 AI ҳастам.\n\nСавол диҳед ё мавзӯ интихоб кунед:',
    kk: 'Сәлеметсіз бе! 👋 Мен Pack24 AI кеңесшісімін.\n\nСұрақ қойыңыз немесе тақырып таңдаңыз:',
    tk: 'Salam! 👋 Men Pack24 AI maslahatçy.\n\nSorag beriň ýa-da tema saýlaň:',
    fa: 'سلام! 👋 من مشاور Pack24 AI هستم.\n\nسوال بپرسید یا موضوع انتخاب کنید:',
};

const SUGGESTIONS: Record<string, { label: string; text: string }[]> = {
    uz: [
        { label: '💰 Narx', text: 'Narxi qancha?' },
        { label: '📦 MOQ', text: 'Minimal buyurtma qancha?' },
        { label: '🖨️ Pechat', text: 'Pechat turlari qanday?' },
        { label: '🚚 Yetkazish', text: 'Yetkazib berish xizmati bormi?' },
        { label: '🎨 Dizayn', text: 'AI dizayn xizmati bormi?' },
        { label: '📞 Aloqa', text: "Qanday bog'lanish mumkin?" },
    ],
    ru: [
        { label: '💰 Цена', text: 'Какова цена?' },
        { label: '📦 MOQ', text: 'Минимальный заказ?' },
        { label: '🖨️ Печать', text: 'Виды печати?' },
        { label: '🚚 Доставка', text: 'Есть ли доставка?' },
        { label: '🎨 Дизайн', text: 'Есть AI дизайн?' },
        { label: '📞 Контакт', text: 'Как связаться?' },
    ],
    en: [
        { label: '💰 Price', text: 'What is the price?' },
        { label: '📦 MOQ', text: 'What is the minimum order?' },
        { label: '🖨️ Print', text: 'What printing types do you offer?' },
        { label: '🚚 Delivery', text: 'Do you offer delivery?' },
        { label: '🎨 Design', text: 'Do you have AI design tools?' },
        { label: '📞 Contact', text: 'How can I contact you?' },
    ],
    qr: [
        { label: '💰 Baha', text: 'Bahası qansha?' },
        { label: '📦 MOQ', text: 'Minimal buyırtpa qansha?' },
        { label: '🖨️ Pechat', text: 'Pechat túrleri qanday?' },
        { label: '🚚 Jetkiziw', text: 'Jetkiziw xızmeti barma?' },
        { label: '🎨 Dizayn', text: 'AI dizayn xızmeti barma?' },
        { label: '📞 Baylanıs', text: 'Qalay baylanıs mumkin?' },
    ],
    zh: [
        { label: '💰 价格', text: '价格是多少？' },
        { label: '📦 起订量', text: '最小订购量是多少？' },
        { label: '🖨️ 印刷', text: '有哪些印刷类型？' },
        { label: '🚚 配送', text: '提供送货服务吗？' },
        { label: '🎨 设计', text: '有AI设计工具吗？' },
        { label: '📞 联系', text: '如何联系你们？' },
    ],
    tr: [
        { label: '💰 Fiyat', text: 'Fiyat nedir?' },
        { label: '📦 MOQ', text: 'Minimum sipariş miktarı?' },
        { label: '🖨️ Baskı', text: 'Baskı çeşitleri nelerdir?' },
        { label: '🚚 Teslimat', text: 'Teslimat hizmeti var mı?' },
        { label: '🎨 Tasarım', text: 'AI tasarım aracı var mı?' },
        { label: '📞 İletişim', text: 'Nasıl iletişime geçebilirim?' },
    ],
    tg: [
        { label: '💰 Нарх', text: 'Нархаш чанд аст?' },
        { label: '📦 MOQ', text: 'Ҳадди ақали фармоиш чанд?' },
        { label: '🖨️ Чоп', text: 'Навъҳои чопкунӣ кадомҳо?' },
        { label: '🚚 Таҳвил', text: 'Хизмати таҳвил ҳаст?' },
        { label: '🎨 Дизайн', text: 'AI дизайн ҳаст?' },
        { label: '📞 Тамос', text: 'Чӣ тавр тамос гирам?' },
    ],
    kk: [
        { label: '💰 Баға', text: 'Бағасы қанша?' },
        { label: '📦 MOQ', text: 'Минималды тапсырыс қанша?' },
        { label: '🖨️ Баспа', text: 'Баспа түрлері қандай?' },
        { label: '🚚 Жеткізу', text: 'Жеткізу қызметі бар ма?' },
        { label: '🎨 Дизайн', text: 'AI дизайн қызметі бар ма?' },
        { label: '📞 Байланыс', text: 'Қалай байланысуға болады?' },
    ],
    tk: [
        { label: '💰 Baha', text: 'Bahasy näçe?' },
        { label: '📦 MOQ', text: 'Iň az sargyt näçe?' },
        { label: '🖨️ Çap', text: 'Çap görnüşleri nähili?' },
        { label: '🚚 Eltip bermek', text: 'Eltip bermek hyzmaty barmy?' },
        { label: '🎨 Dizaýn', text: 'AI dizaýn hyzmaty barmy?' },
        { label: '📞 Habarlaşmak', text: 'Nähili habarlaşyp bolar?' },
    ],
    fa: [
        { label: '💰 قیمت', text: 'قیمت چقدر است؟' },
        { label: '📦 حداقل', text: 'حداقل سفارش چقدر است؟' },
        { label: '🖨️ چاپ', text: 'انواع چاپ چیست؟' },
        { label: '🚚 تحویل', text: 'خدمات تحویل دارید؟' },
        { label: '🎨 طراحی', text: 'ابزار طراحی AI دارید؟' },
        { label: '📞 تماس', text: 'چطور تماس بگیرم؟' },
    ],
};

const getGreetingTime = (): Record<string, string> => {
    const h = new Date().getHours();
    if (h < 12) return { uz: 'Xayrli tong', ru: 'Доброе утро', en: 'Good morning', qr: 'Xayrli tañ', zh: '早上好', tr: 'Günaydın', tg: 'Субҳ бахайр', kk: 'Қайырлы таң', tk: 'Ertiriňiz haýyrly', fa: 'صبح بخیر' };
    if (h < 18) return { uz: 'Xayrli kun', ru: 'Добрый день', en: 'Good afternoon', qr: 'Xayrli kún', zh: '下午好', tr: 'İyi günler', tg: 'Рӯзи нек', kk: 'Қайырлы күн', tk: 'Gündiziňiz haýyrly', fa: 'روز بخیر' };
    return { uz: 'Xayrli kech', ru: 'Добрый вечер', en: 'Good evening', qr: 'Xayrli kesh', zh: '晚上好', tr: 'İyi akşamlar', tg: 'Шаби хуш', kk: 'Қайырлы кеш', tk: 'Agşamyňyz haýyrly', fa: 'عصر بخیر' };
};

const renderMessageText = (text: string) => {
    // Remove markdown bold characters
    let cleanText = text.replace(/\*\*/g, '');
    // Replace markdown bullet points with a standard dash
    cleanText = cleanText.replace(/(^|\n)\s*\*\s/g, '$1- ');

    // Matches links, old [MODEL:...], and new [GENERATE_3D: "..."]
    const tokenRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\[MODEL:([^\]]+)\])|(\[GENERATE_3D:\s*"([^"]+)"\])/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tokenRegex.exec(cleanText)) !== null) {
        if (match.index > lastIndex) {
            parts.push(cleanText.substring(lastIndex, match.index));
        }
        
        if (match[4]) {
            // Legacy MODEL token
            const inner = match[5];
            const partsArr = inner.split('|');
            const modelId = partsArr[0];
            let textureUrl, logoUrl;
            partsArr.forEach(p => {
                if (p.startsWith('TEXTURE:')) textureUrl = p.replace('TEXTURE:', '');
                if (p.startsWith('LOGO:')) logoUrl = p.replace('LOGO:', '');
            });
            parts.push(<Mini3DViewer key={`model-${match.index}`} modelId={modelId} textureUrl={textureUrl} logoUrl={logoUrl} />);
        } else if (match[6]) {
            // New GENERATE_3D token
            const prompt = match[7];
            parts.push(<ExternalModelViewer key={`gen3d-${match.index}`} prompt={prompt} />);
        } else {
            // Link token
            parts.push(
                <a 
                    key={`link-${match.index}`} 
                    href={match[3]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-100 underline decoration-blue-300/50 underline-offset-2 font-bold transition-colors"
                    onClick={e => e.stopPropagation()}
                >
                    {match[2]}
                </a>
            );
        }
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < cleanText.length) {
        parts.push(cleanText.substring(lastIndex));
    }

    return parts.length > 0 ? parts : cleanText;
};

export default function AIConsultant({ model, dims, totalPrice, unitPrice, material, quantity }: AIConsultantProps) {
    const { language } = useLanguage();
    const { generateResponse, isTyping, history: _aiHistory, clearHistory: _clearHistory, abort: _abort } = useAI();
    const [_typingText, _setTypingText] = useState('');

    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [hasOpened, setHasOpened] = useState(false);
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<{ data: string, mimeType: string } | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            text: WELCOME[language] ?? WELCOME['uz'],
            sender: 'ai',
            timestamp: new Date(),
        },
    ]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Auto-open with delay + unread badge after first load
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasOpened) setUnreadCount(1);
        }, 5000);
        return () => clearTimeout(timer);
    }, [hasOpened]);

    const handleOpen = () => {
        setIsOpen(true);
        setHasOpened(true);
        setUnreadCount(0);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert(language === 'uz' ? 'Fayl hajmi 5MB dan kichik bo\'lishi kerak' : 'File must be under 5MB');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setFilePreview(base64String);
            
            // Extract mime and pure base64
            const mimeType = file.type;
            const data = base64String.split(',')[1];
            setSelectedFile({ data, mimeType });
        };
        reader.readAsDataURL(file);
    };

    const handleSend = async (textArg?: string) => {
        const textToSend = (textArg ?? input).trim().slice(0, 500);
        if ((!textToSend && !selectedFile) || isTyping) return;

        const currentFile = selectedFile;
        const userMsg: Message = {
            id: Date.now(),
            text: textToSend || (language === 'uz' ? '📷 Rasm yuborildi' : '📷 Image sent'),
            sender: 'user',
            timestamp: new Date(),
            inlineData: currentFile || undefined,
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        const aiResponseText = await generateResponse(userMsg.text, {
            model,
            dims,
            totalPrice,
            unitPrice,
            language,
            material,
            quantity,
        }, currentFile || undefined);

        if (!aiResponseText) return;

        // Typewriter effect
        const aiMsgId = Date.now() + 1;
        setMessages(prev => [...prev, { id: aiMsgId, text: '', sender: 'ai', timestamp: new Date() }]);

        const chars = aiResponseText.split('');
        let displayed = '';
        for (let i = 0; i < chars.length; i++) {
            displayed += chars[i];
            const snapshot = displayed;
            setMessages(prev =>
                prev.map(m => m.id === aiMsgId ? { ...m, text: snapshot } : m)
            );
            // Variable speed: faster for spaces, slower for punctuation
            const ch = chars[i];
            const delay = '.!?\n'.includes(ch) ? 40 : ch === ' ' ? 10 : 15;
            await new Promise(r => setTimeout(r, delay));
        }
    };

    const suggestions = SUGGESTIONS[language] ?? SUGGESTIONS['uz'];
    const greetTime = getGreetingTime();
    const greetLabel = greetTime[language] ?? greetTime['en'];

    return (
        <>
            {/* ── FLOATING BUTTON ── */}
            <button
                id="ai-chat-toggle"
                onClick={isOpen ? () => setIsOpen(false) : handleOpen}
                aria-label={isOpen ? 'Close AI Chat' : 'Open AI Chat'}
                className={`fixed bottom-6 right-6 z-[60] flex items-center justify-center transition-all duration-500
                    ${isOpen
                        ? 'w-12 h-12 bg-gray-700/90 hover:bg-gray-600/90 rounded-full backdrop-blur-md shadow-xl rotate-0'
                        : 'w-14 h-14 rounded-2xl shadow-2xl hover:scale-110 active:scale-95 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700'
                    }`}
                style={isOpen ? {} : { boxShadow: '0 8px 32px rgba(79,70,229,0.45)' }}
            >
                {isOpen ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="white" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <>
                        {/* AI Robot Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="white" className="w-7 h-7">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                        </svg>
                        {/* Puls animatsiyasi */}
                        <span className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-indigo-400 pointer-events-none" />
                    </>
                )}

                {/* Unread badge */}
                {!isOpen && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* ── CHAT WINDOW ── */}
            {isOpen && (
                <div
                    id="ai-chat-window"
                    className="fixed bottom-24 right-4 md:right-6 w-[92vw] md:w-[420px] max-h-[82vh] rounded-[28px] overflow-hidden z-[60] flex flex-col shadow-2xl border border-white/20"
                    style={{
                        background: 'rgba(15,23,42,0.92)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
                        animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                >
                    {/* ── Header ── */}
                    <div
                        className="flex items-center gap-3 px-5 py-4 shrink-0 border-b border-white/10"
                        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #1e3a5f 100%)' }}
                    >
                        {/* Avatar */}
                        <div className="relative shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="white" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                                </svg>
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-[#1e1b4b] shadow" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-base leading-tight tracking-tight">Pack24 AI</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                                <p className="text-green-300/80 text-[11px] font-medium">{greetLabel} · Online</p>
                            </div>
                        </div>

                        {/* Close */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
                            aria-label="Close chat"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="rgba(255,255,255,0.7)" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* ── Messages ── */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 scroll-smooth" style={{ minHeight: 0 }}>

                        {/* Date badge */}
                        <div className="flex justify-center">
                            <span className="px-3 py-1 rounded-full bg-white/5 text-white/30 text-[10px] font-medium border border-white/10">
                                {new Date().toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'uz' ? 'uz-UZ' : 'en-US', { day: 'numeric', month: 'long' })}
                            </span>
                        </div>

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                            >
                                {/* AI avatar */}
                                {msg.sender === 'ai' && (
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shrink-0 mt-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-3.5 h-3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                        </svg>
                                    </div>
                                )}

                                <div
                                    className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                                        ${msg.sender === 'user'
                                            ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-sm shadow-lg shadow-blue-900/30'
                                            : 'bg-white/8 border border-white/10 text-gray-100 rounded-tl-sm'
                                        }`}
                                    style={msg.sender === 'ai' ? { background: 'rgba(255,255,255,0.07)' } : {}}
                                >
                                    {msg.inlineData && (
                                        <div className="mb-2 max-w-xs overflow-hidden rounded-lg bg-black/20">
                                            {msg.inlineData.mimeType.startsWith('image/') ? (
                                                <img src={`data:${msg.inlineData.mimeType};base64,${msg.inlineData.data}`} alt="Upload" className="w-full h-auto object-cover opacity-90 hover:opacity-100 transition-opacity" />
                                            ) : (
                                                <div className="flex items-center gap-2 p-2 text-xs font-bold text-blue-200">
                                                    <Paperclip size={14} /> {msg.inlineData.mimeType.split('/')[1].toUpperCase()} Hujjat
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {msg.text && renderMessageText(msg.text)}
                                    <div className={`text-[10px] mt-1.5 opacity-50 flex ${msg.sender === 'user' ? 'justify-end text-blue-100' : 'justify-start text-gray-400'}`}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="flex justify-start gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center shrink-0 mt-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                                    </svg>
                                </div>
                                <div
                                    className="px-4 py-3.5 rounded-2xl rounded-tl-sm border border-white/10 flex items-center gap-1.5"
                                    style={{ background: 'rgba(255,255,255,0.07)' }}
                                >
                                    {[0, 1, 2].map(i => (
                                        <span
                                            key={i}
                                            className="w-2 h-2 bg-blue-400 rounded-full"
                                            style={{
                                                animation: 'typingBounce 1.2s ease-in-out infinite',
                                                animationDelay: `${i * 0.2}s`,
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* ── Quick Suggestions ── */}
                    {messages.length <= 2 && (
                        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                            {suggestions.slice(0, 4).map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(s.text)}
                                    disabled={isTyping}
                                    className="whitespace-nowrap px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 border shrink-0"
                                    style={{
                                        background: 'rgba(79,70,229,0.12)',
                                        borderColor: 'rgba(129,140,248,0.25)',
                                        color: 'rgba(199,210,254,0.9)',
                                    }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── File Preview ── */}
                    {filePreview && (
                        <div className="px-4 pb-2 flex shrink-0">
                            <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500/50 shadow-md">
                                {selectedFile?.mimeType.startsWith('image/') ? (
                                    <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-blue-500/20 text-blue-200">
                                        <Paperclip size={20} />
                                        <span className="text-[9px] font-bold mt-1">DOC</span>
                                    </div>
                                )}
                                <button 
                                    onClick={() => { setFilePreview(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} 
                                    className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Input Area ── */}
                    <div
                        className="px-4 pb-5 pt-3 flex gap-3 shrink-0 border-t border-white/8"
                        style={{ background: 'rgba(15,23,42,0.6)' }}
                    >
                        <input
                            type="file"
                            accept="image/*,application/pdf"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isTyping}
                            aria-label="Attach file"
                            className="w-11 h-11 flex items-center justify-center rounded-xl transition-all hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-40 shrink-0"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                        >
                            <Paperclip size={18} />
                        </button>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={
                                language === 'uz'
                                    ? 'Savolingizni yozing...'
                                    : language === 'ru'
                                    ? 'Введите вопрос...'
                                    : 'Type your question...'
                            }
                            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all text-white placeholder-white/25"
                            style={{
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(255,255,255,0.12)',
                            }}
                            disabled={isTyping}
                            id="ai-chat-input"
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={(!input.trim() && !selectedFile) || isTyping}
                            aria-label="Send message"
                            className="w-11 h-11 flex items-center justify-center rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 15px rgba(79,70,229,0.4)' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-4.5 h-4.5">
                                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                            </svg>
                        </button>
                    </div>

                    {/* ── Powered by badge ── */}
                    <div className="px-4 pb-3 flex justify-center shrink-0">
                        <span className="text-[10px] text-white/20 font-medium">Powered by Pack24 AI · pack24.uz</span>
                    </div>
                </div>
            )}

            {/* ── CSS Animations ── */}
            <style jsx global>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes typingBounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40%           { transform: translateY(-6px); opacity: 1; }
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </>
    );
}
