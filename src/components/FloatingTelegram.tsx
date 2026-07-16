'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import Link from 'next/link';

export default function FloatingTelegram() {
    const [isVisible, setIsVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        // Show the button after 3 seconds of page load to not distract immediately
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end">
            {/* Tooltip Message */}
            <div 
                className={`mb-3 bg-white text-gray-800 px-4 py-2 rounded-2xl shadow-lg border border-gray-100 text-sm font-medium transition-all duration-300 transform origin-bottom-right ${isHovered ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
                style={{ 
                    borderBottomRightRadius: '4px'
                }}
            >
                Savollaringiz bormi? Bizga yozing! 👋
            </div>

            {/* Telegram Button */}
            <Link
                href="https://t.me/Pack24AI_bot"
                target="_blank"
                rel="noopener noreferrer"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="group relative flex items-center justify-center w-14 h-14 bg-[#2AABEE] text-white rounded-full shadow-xl hover:bg-[#229ED9] hover:scale-110 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#2AABEE]/30"
                aria-label="Telegram orqali bog'lanish"
            >
                <div className="absolute inset-0 rounded-full animate-ping bg-[#2AABEE] opacity-20 group-hover:animate-none"></div>
                <MessageCircle className="w-7 h-7 relative z-10" />
            </Link>
            
            {/* Close button - optional */}
            <button 
                onClick={() => setIsVisible(false)}
                className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-gray-600 rounded-full p-1 shadow-md transition-opacity"
                aria-label="Yopish"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
