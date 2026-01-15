import { ReactNode } from 'react';
import { Zap } from 'lucide-react';

interface BrandProfile {
    name?: string;
    logo_url?: string;
    primary_color?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_website?: string;
}

interface SellerLayoutProps {
    children: ReactNode;
    progress: number; // 0 to 100
    address?: string;
    stepName?: string;
    completedCount: number;
    totalCount: number;
    brandProfile?: BrandProfile | null;
}

export function SellerLayout({
    children,
    progress,
    address,
    stepName,
    completedCount,
    totalCount,
    brandProfile
}: SellerLayoutProps) {
    // Use brand primary color or fallback to slate blue
    const primaryColor = brandProfile?.primary_color || '#475569';
    // Ensure color is safe (not oklch or lab format)
    const safePrimaryColor = primaryColor.startsWith('oklch') || primaryColor.startsWith('lab') ? '#475569' : primaryColor;

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-slate-900/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/50 backdrop-blur-xl">
                <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
                    {/* Top row: Brand + Property */}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            {brandProfile?.logo_url ? (
                                <img
                                    src={brandProfile.logo_url}
                                    alt={brandProfile.name || 'Organization'}
                                    className="h-8 sm:h-10 w-auto max-w-[100px] sm:max-w-[120px] object-contain shrink-0"
                                />
                            ) : brandProfile?.name ? (
                                <div
                                    className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-xs sm:text-sm shrink-0"
                                    style={{ backgroundColor: safePrimaryColor }}
                                >
                                    {brandProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                            ) : (
                                <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20 shrink-0">
                                    <img src="/logo-sm.png" alt="UtilitySheet Logo" className="h-3 w-3 sm:h-4 sm:w-4" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <h1 className="font-bold text-xs sm:text-sm text-foreground truncate">
                                    {brandProfile?.name || 'UtilitySheet'}
                                </h1>
                                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                    {brandProfile?.name ? 'Utility Information Request' : 'Simplify Utility Handoffs'}
                                </p>
                            </div>
                        </div>
                        {address && (
                            <div className="text-right hidden sm:block shrink-0">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Property</p>
                                <p className="text-sm text-foreground font-medium truncate max-w-[180px]">{address}</p>
                            </div>
                        )}
                    </div>

                    {/* Mobile address display */}
                    {address && (
                        <div className="sm:hidden mb-3 px-3 py-2 bg-muted/50 rounded-lg border border-border">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Property</p>
                            <p className="text-xs text-foreground font-medium truncate">{address}</p>
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-medium">{stepName || 'Progress'}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1.5 sm:h-1 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    background: brandProfile?.primary_color
                                        ? `linear-gradient(to right, ${safePrimaryColor}, ${safePrimaryColor}dd)`
                                        : 'linear-gradient(to right, rgb(71, 85, 105), rgb(100, 116, 139))'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area - adjusted padding for mobile */}
            <main className="relative z-10 pt-36 sm:pt-32 pb-16 sm:pb-20 px-4 min-h-screen flex flex-col max-w-2xl mx-auto">
                {children}
            </main>
        </div>
    );
}

