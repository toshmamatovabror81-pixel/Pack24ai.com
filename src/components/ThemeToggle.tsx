'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="w-9 h-9 rounded-xl border border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-700"></div>;
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Qorong'i/Yorug' rejim"
            aria-label="Toggle theme"
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white dark:bg-slate-800 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
        >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
}
