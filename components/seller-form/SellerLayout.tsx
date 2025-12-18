import { ReactNode } from 'react';
import { Zap } from 'lucide-react';

interface SellerLayoutProps {
    children: ReactNode;
    progress: number; // 0 to 100
    address?: string;
    completedCount: number;
    totalCount: number;
}

export function SellerLayout({
    children,
    progress,
    address,
    completedCount,
    totalCount
}: SellerLayoutProps) {
    return (
        <div className="min-h-screen bg-black text-white selection:bg-emerald-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                                <Zap className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <h1 className="font-bold text-sm text-zinc-100">UtilitySheet</h1>
                                <p className="text-xs text-zinc-500">Simplify Utility Handoffs</p>
                            </div>
                        </div>
                        {address && (
                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Property</p>
                                <p className="text-sm text-zinc-300 font-medium truncate max-w-[200px]">{address}</p>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 pt-32 pb-20 px-4 min-h-screen flex flex-col max-w-2xl mx-auto">
                {children}
            </main>
        </div>
    );
}
