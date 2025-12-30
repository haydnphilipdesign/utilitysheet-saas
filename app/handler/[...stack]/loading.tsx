export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Loading...</p>
            </div>
        </div>
    );
}
