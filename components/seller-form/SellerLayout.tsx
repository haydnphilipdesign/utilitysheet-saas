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
    completedCount: number;
    totalCount: number;
    brandProfile?: BrandProfile | null;
}

export function SellerLayout({
    children,
    progress,
    address,
    completedCount,
    totalCount,
    brandProfile
}: SellerLayoutProps) {
    // Use brand primary color or fallback to emerald
    const primaryColor = brandProfile?.primary_color || '#10b981';
    // Ensure color is safe (not oklch or lab format)
    const safePrimaryColor = primaryColor.startsWith('oklch') || primaryColor.startsWith('lab') ? '#10b981' : primaryColor;

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-900/10 rounded-full blur-[128px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[128px]" />
            </div>

            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/50 backdrop-blur-xl">
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            {brandProfile?.logo_url ? (
                                <img
                                    src={brandProfile.logo_url}
                                    alt={brandProfile.name || 'Organization'}
                                    className="h-10 w-auto max-w-[120px] object-contain"
                                />
                            ) : brandProfile?.name ? (
                                <div
                                    className="p-2 rounded-xl shadow-lg flex items-center justify-center text-white font-bold text-sm"
                                    style={{ backgroundColor: safePrimaryColor }}
                                >
                                    {brandProfile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                            ) : (
                                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20">
                                    <Zap className="h-4 w-4 text-white" />
                                </div>
                            )}
                            <div>
                                <h1 className="font-bold text-sm text-foreground">
                                    {brandProfile?.name || 'UtilitySheet'}
                                </h1>
                                <p className="text-xs text-muted-foreground">
                                    {brandProfile?.name ? 'Utility Information Request' : 'Simplify Utility Handoffs'}
                                </p>
                            </div>
                        </div>
                        {address && (
                            <div className="text-right hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Property</p>
                                <p className="text-sm text-foreground font-medium truncate max-w-[200px]">{address}</p>
                            </div>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full transition-all duration-500 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    background: brandProfile?.primary_color
                                        ? `linear-gradient(to right, ${safePrimaryColor}, ${safePrimaryColor}dd)`
                                        : 'linear-gradient(to right, rgb(5, 150, 105), rgb(52, 211, 153))'
                                }}
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

