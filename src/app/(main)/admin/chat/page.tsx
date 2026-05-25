'use client';

import { useState } from 'react';
import {
    Search,
    Send,
    Phone,
    MoreVertical,
    Paperclip,
    Mic,
    Smile,
    Bot,
    Globe,
    Check,
    CheckCheck,
    Clock,
    User,
    ShoppingBag,
    MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// --- Types ---
type MessageSource = 'telegram' | 'website' | 'instagram';
type MessageType = 'text' | 'image' | 'audio';

interface Message {
    id: number;
    text: string;
    isOwn: boolean;
    timestamp: string;
    status: 'sent' | 'delivered' | 'read';
    type: MessageType;
}

interface ChatSession {
    id: number;
    user: {
        name: string;
        avatar?: string;
        status: 'online' | 'offline';
        lastSeen?: string;
        phone: string;
        crmId: number;
    };
    source: MessageSource;
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
    messages: Message[];
    activeOrder?: {
        id: string;
        total: string;
        status: string;
        items: string;
    };
}

// --- Mock Data ---
const chats: ChatSession[] = [
    {
        id: 1,
        user: { name: 'Aziz Rakhimov', status: 'online', phone: '+998 90 123 45 67', crmId: 101 },
        source: 'telegram',
        lastMessage: 'Gofra karobka narxi qancha?',
        lastMessageTime: '10:45',
        unreadCount: 2,
        messages: [
            { id: 1, text: 'Assalomu alaykum', isOwn: false, timestamp: '10:44', status: 'read', type: 'text' },
            { id: 2, text: 'Gofra karobka narxi qancha?', isOwn: false, timestamp: '10:45', status: 'read', type: 'text' }
        ],
        activeOrder: {
            id: 'ORD-2024',
            total: '1,250,000 so\'m',
            status: 'pending',
            items: '350x Gofra Karobka'
        }
    },
    {
        id: 2,
        user: { name: 'Mehmon (Sayt)', status: 'offline', lastSeen: '5 daqiqa oldin', phone: '', crmId: 0 },
        source: 'website',
        lastMessage: 'Operator bilan bog\'lanmoqchiman',
        lastMessageTime: 'Kecha',
        unreadCount: 0,
        messages: [
            { id: 1, text: 'Salom, yetkazib berish xizmati bormi?', isOwn: false, timestamp: '14:30', status: 'read', type: 'text' },
            { id: 2, text: 'Ha, Toshkent bo\'ylab bepul.', isOwn: true, timestamp: '14:35', status: 'read', type: 'text' },
            { id: 3, text: 'Rahmat! Operator bilan bog\'lanmoqchiman', isOwn: false, timestamp: '14:36', status: 'read', type: 'text' }
        ]
    },
    {
        id: 3,
        user: { name: 'Malika Karimova', status: 'offline', lastSeen: '1 soat oldin', phone: '+998 99 888 77 66', crmId: 102 },
        source: 'telegram',
        lastMessage: 'Rahmat, qabul qildim 👍',
        lastMessageTime: 'Kecha',
        unreadCount: 0,
        messages: [
            { id: 1, text: 'Buyurtmangiz yuborildi.', isOwn: true, timestamp: '16:00', status: 'read', type: 'text' },
            { id: 2, text: 'Rahmat, qabul qildim 👍', isOwn: false, timestamp: '16:05', status: 'read', type: 'text' }
        ],
        activeOrder: {
            id: 'ORD-2023',
            total: '450,000 so\'m',
            status: 'completed',
            items: '10kg Strech Plyonka'
        }
    }
];

export default function ChatPage() {
    const [selectedChatId, setSelectedChatId] = useState<number>(1);
    const [inputText, setInputText] = useState('');
    const [chatList, setChatList] = useState(chats);

    const activeChat = chatList.find(c => c.id === selectedChatId) || chatList[0];

    const handleSendMessage = () => {
        if (!inputText.trim()) return;
        const newMessage: Message = {
            id: Date.now(),
            text: inputText,
            isOwn: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent',
            type: 'text'
        };

        const updatedChats = chatList.map(chat => {
            if (chat.id === selectedChatId) {
                return {
                    ...chat,
                    messages: [...chat.messages, newMessage],
                    lastMessage: inputText,
                    lastMessageTime: newMessage.timestamp
                };
            }
            return chat;
        });

        setChatList(updatedChats);
        setInputText('');
    };

    const getSourceIcon = (source: MessageSource) => {
        switch (source) {
            case 'telegram': return <Bot size={14} className="text-blue-400" />;
            case 'website': return <Globe size={14} className="text-emerald-400" />;
            default: return <MessageSquare size={14} className="text-gray-400" />;
        }
    };

    return (
        <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

            {/* 1. Contact List (Sidebar) */}
            <div className="w-[320px] flex flex-col border-r border-gray-100 bg-slate-50/50">
                {/* Search Header */}
                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Qidirish..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {chatList.map(chat => (
                        <div
                            key={chat.id}
                            onClick={() => setSelectedChatId(chat.id)}
                            className={cn(
                                "p-4 cursor-pointer transition-all hover:bg-white border-b border-gray-50 relative group",
                                selectedChatId === chat.id ? "bg-white border-l-4 border-l-blue-500 shadow-sm" : "border-l-4 border-l-transparent"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={cn("font-bold text-sm truncate max-w-[180px]", selectedChatId === chat.id ? "text-blue-600" : "text-slate-700")}>
                                    {chat.user.name}
                                </h4>
                                <span className="text-[10px] text-gray-400 font-medium">{chat.lastMessageTime}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-xs text-slate-500 truncate max-w-[200px]">{chat.lastMessage}</p>
                                {chat.unreadCount > 0 && (
                                    <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {chat.unreadCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="bg-white border border-gray-100 p-1 rounded-md shadow-sm">
                                    {getSourceIcon(chat.source)}
                                </span>
                                {chat.activeOrder && (
                                    <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded border border-amber-100 font-medium">
                                        Buyurtma faol
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Chat Window (Main) */}
            <div className="flex-1 flex flex-col bg-[#eef1f5]">
                {/* Chat Header */}
                <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm">
                                {activeChat.user.name.charAt(0)}
                            </div>
                            {activeChat.user.status === 'online' && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-sm">{activeChat.user.name}</h3>
                            <div className="flex items-center gap-1.5">
                                <span className={cn("text-xs", activeChat.user.status === 'online' ? "text-emerald-500 font-medium" : "text-slate-400")}>
                                    {activeChat.user.status === 'online' ? 'Online' : activeChat.user.lastSeen}
                                </span>
                                <span className="text-gray-300">•</span>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                    {getSourceIcon(activeChat.source)}
                                    <span className="capitalize">{activeChat.source}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="hidden md:flex gap-1" aria-label="Quick Actions">
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-blue-600">
                                <Phone size={18} />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-blue-600">
                                <Search size={18} />
                            </Button>
                        </div>
                        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-700">
                            <MoreVertical size={18} />
                        </Button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeChat.messages.map((msg) => (
                        <div key={msg.id} className={cn("flex w-full", msg.isOwn ? "justify-end" : "justify-start")}>
                            <div className={cn(
                                "max-w-[70%] px-4 py-3 rounded-2xl shadow-sm text-sm relative group",
                                msg.isOwn
                                    ? "bg-blue-500 text-white rounded-tr-none"
                                    : "bg-white text-slate-800 rounded-tl-none border border-gray-100"
                            )}>
                                <p className="leading-relaxed">{msg.text}</p>
                                <div className={cn(
                                    "flex items-center gap-1 mt-1 text-[10px] justify-end opacity-70",
                                    msg.isOwn ? "text-blue-100" : "text-slate-400"
                                )}>
                                    <span>{msg.timestamp}</span>
                                    {msg.isOwn && (
                                        msg.status === 'read' ? <CheckCheck size={12} /> : <Check size={12} />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-200">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-2 flex items-end gap-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                        <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600 h-10 w-10 shrink-0 rounded-lg">
                            <Paperclip size={20} />
                        </Button>
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Xabar yozing..."
                            className="flex-1 bg-transparent border-none outline-none text-slate-800 text-sm max-h-32 py-2.5 resize-none placeholder:text-gray-400"
                            rows={1}
                        />
                        <div className="flex items-center gap-1 pb-1">
                            <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600 h-8 w-8 rounded-lg">
                                <Smile size={20} />
                            </Button>
                            {inputText.trim() ? (
                                <Button
                                    onClick={handleSendMessage}
                                    size="icon"
                                    className="bg-blue-500 hover:bg-blue-600 text-white h-9 w-9 rounded-lg shadow-md transition-all transform hover:scale-105"
                                    aria-label="Send Message"
                                >
                                    <Send size={18} className="ml-0.5" />
                                </Button>
                            ) : (
                                <Button size="icon" variant="ghost" className="text-slate-400 hover:text-slate-600 h-9 w-9 rounded-lg">
                                    <Mic size={20} />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Context Panel (Right Sidebar) */}
            <div className="w-[300px] border-l border-gray-200 bg-white hidden xl:flex flex-col">
                <div className="p-6 border-b border-gray-100 text-center">
                    <div className="w-20 h-20 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-500 font-bold text-2xl mb-3 border-4 border-slate-50">
                        {activeChat.user.name.charAt(0)}
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg">{activeChat.user.name}</h3>
                    <p className="text-emerald-500 text-xs font-medium mt-1 mb-4 flex items-center justify-center gap-1">
                        <CheckCircle2 size={12} /> Tasdiqlangan Mijoz
                    </p>

                    <Link href={`/admin/customers?id=${activeChat.user.crmId}`}>
                        <Button variant="outline" className="w-full border-blue-100 text-blue-600 hover:bg-blue-50">
                            <User size={16} className="mr-2" />
                            CRM Profil
                        </Button>
                    </Link>
                </div>

                <div className="flex-1 p-6 overflow-y-auto">
                    {/* Active Order Card */}
                    {activeChat.activeOrder ? (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Faol Buyurtma</span>
                                <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                                    {activeChat.activeOrder.status}
                                </Badge>
                            </div>
                            <h4 className="font-bold text-slate-800 mb-1">{activeChat.activeOrder.id}</h4>
                            <p className="text-xs text-slate-600 mb-2">{activeChat.activeOrder.items}</p>
                            <div className="text-sm font-black text-slate-800 border-t border-amber-100 pt-2 mt-2">
                                {activeChat.activeOrder.total}
                            </div>
                            <Button size="sm" className="w-full mt-3 bg-white text-amber-700 hover:bg-amber-100 border border-amber-200 text-xs h-8">
                                <ShoppingBag size={14} className="mr-2" />
                                Buyurtmani ko&apos;rish
                            </Button>
                        </div>
                    ) : (
                        <div className="border border-dashed border-gray-200 rounded-xl p-6 text-center mb-6">
                            <ShoppingBag className="mx-auto text-gray-300 mb-2" size={24} />
                            <p className="text-xs text-slate-400">Faol buyurtma yo&apos;q</p>
                        </div>
                    )}

                    {/* Quick Info */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ma&apos;lumotlar</h4>

                        <div className="flex items-center justify-between text-sm group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors">
                            <span className="text-slate-500 flex items-center gap-2">
                                <Phone size={14} /> Telefon
                            </span>
                            <span className="font-medium text-slate-800">{activeChat.user.phone || '-'}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors">
                            <span className="text-slate-500 flex items-center gap-2">
                                <Clock size={14} /> Oxirgi faollik
                            </span>
                            <span className="font-medium text-slate-800">{activeChat.user.lastSeen || 'Hozir'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper icon component for context
function CheckCircle2({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    )
}
