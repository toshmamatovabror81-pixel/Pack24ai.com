'use client';

import { useState } from 'react';import { Play, Square, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Task {
    id: string;
    title: string;
    spec: string;
    quantity: number;
    status: 'pending' | 'active' | 'completed';
    progress: number;
}

const mockTasks: Task[] = [
    { id: 'ORD-1024', title: 'Pizza Box 30x30 (Logo)', spec: '350 dona • Gofra B-Profil', quantity: 350, status: 'pending', progress: 0 },
    { id: 'ORD-1025', title: 'A4 Arxiv Quti', spec: '1200 dona • Karton 300g', quantity: 1200, status: 'pending', progress: 0 },
    { id: 'ORD-1026', title: 'Sovg\'a Qutisi (Black)', spec: '50 dona • Dizayn #4', quantity: 50, status: 'completed', progress: 50 },
];

export default function TaskTerminal({ roleName, roleColor }: { roleName: string, roleColor: string }) {
    const [tasks, setTasks] = useState(mockTasks);
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const [brakCount, setBrakCount] = useState(0);

    const handleStart = (task: Task) => {
        setActiveTask({ ...task, status: 'active' });
        toast.success(`${task.id} boshlandi`);
    };

    const handleStop = () => {
        if (!activeTask) return;
        setActiveTask(null);
        toast.info("Ish to'xtatildi");
    };

    const handleFinish = () => {
        if (!activeTask) return;
        setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, status: 'completed', progress: t.quantity } : t));
        setActiveTask(null);
        toast.success("Vazifa yakunlandi! QC ga yuborildi.");
    };

    const colorClasses = {
        emerald: "bg-emerald-500 hover:bg-emerald-600 text-white",
        blue: "bg-blue-500 hover:bg-blue-600 text-white",
        amber: "bg-amber-500 hover:bg-amber-600 text-white",
    };

    const activeColor = colorClasses[roleColor as keyof typeof colorClasses] || colorClasses.emerald;

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                    <Link href="/terminal" className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
                        <ArrowLeft />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold">{roleName}</h1>
                        <p className="text-xs text-slate-400">Operator: Aziz R.</p>
                    </div>
                </div>
                <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
                    <span className="text-sm font-mono">{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Left: Task List */}
                <div className="space-y-4">
                    <h2 className="text-slate-500 font-bold uppercase text-sm px-2">Kutilayotgan vazifalar</h2>
                    {tasks.filter(t => t.status !== 'completed').map(task => (
                        <div key={task.id} className={cn(
                            "bg-white p-6 rounded-3xl border-2 transition-all shadow-sm",
                            activeTask?.id === task.id ? `border-${roleColor}-500 ring-4 ring-${roleColor}-500/20` : "border-transparent"
                        )}>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{task.id}</span>
                                    <h3 className="text-xl font-bold text-slate-800 mt-2">{task.title}</h3>
                                    <p className="text-slate-500 font-medium">{task.spec}</p>
                                </div>
                                <div className="text-right">
                                    <span className="block text-2xl font-black text-slate-800">{task.quantity}</span>
                                    <span className="text-xs text-slate-400 font-bold uppercase">dona</span>
                                </div>
                            </div>

                            {activeTask?.id === task.id ? (
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        onClick={handleStop}
                                        className="bg-slate-200 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-300 transition-colors"
                                    >
                                        <Square fill="currentColor" size={20} /> PAUZA
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        className="bg-emerald-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30"
                                    >
                                        <CheckCircle2 size={24} /> TUGATISH
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => handleStart(task)}
                                    disabled={!!activeTask}
                                    className={cn(
                                        "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all mt-4",
                                        activeTask ? "bg-slate-100 text-slate-400 cursor-not-allowed" : activeColor
                                    )}
                                >
                                    <Play fill="currentColor" size={20} /> BOSHLASH
                                </button>
                            )}
                        </div>
                    ))}

                    {tasks.filter(t => t.status !== 'completed').length === 0 && (
                        <div className="text-center p-10 text-slate-400">
                            Vazifalar qolmadi 🎉
                        </div>
                    )}
                </div>

                {/* Right: Active Task Control (Only visible when active) */}
                {activeTask && (
                    <div className="bg-slate-900 rounded-3xl p-6 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32"></div>

                        <div>
                            <span className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-2 block animate-pulse">● Jarayonda</span>
                            <h2 className="text-3xl font-bold mb-2">{activeTask.title}</h2>
                            <p className="text-slate-400 text-lg">{activeTask.spec}</p>
                        </div>

                        <div className="py-10">
                            <div className="flex justify-between text-sm mb-2 text-slate-400 border-b border-white/10 pb-4">
                                <span>Maqsad:</span>
                                <span className="text-white font-mono text-xl">{activeTask.quantity}</span>
                            </div>

                            {/* Defect Counter */}
                            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mt-8">
                                <label className="text-red-400 text-sm font-bold uppercase mb-2 block flex items-center gap-2">
                                    <AlertTriangle size={16} /> Brak (Nuqson)
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setBrakCount(Math.max(0, brakCount - 1))}
                                        className="w-14 h-14 bg-red-500/20 rounded-xl flex items-center justify-center text-red-400 text-2xl font-bold hover:bg-red-500/30 transition-colors"
                                    >-</button>
                                    <span className="flex-1 text-center text-4xl font-mono font-bold text-white">{brakCount}</span>
                                    <button
                                        onClick={() => setBrakCount(brakCount + 1)}
                                        className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold transition-colors"
                                    >+</button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white/5 rounded-2xl p-4 text-center">
                            <p className="text-slate-400 text-sm mb-1">Jarayon vaqti</p>
                            <span className="text-3xl font-mono font-bold">00:14:32</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
