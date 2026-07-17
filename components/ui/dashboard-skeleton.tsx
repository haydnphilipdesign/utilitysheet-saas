import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
    return (
        <div role="status" aria-live="polite" className="space-y-6 sm:space-y-8">
            <span className="sr-only">Loading dashboard…</span>

            <div>
                <Skeleton className="mb-2 h-9 w-44" />
                <Skeleton className="h-5 w-full max-w-xl" />
            </div>

            <Card className="gap-0 py-0">
                <CardHeader className="border-b border-border/60 py-4 sm:py-4">
                    <Skeleton className="h-6 w-52" />
                    <Skeleton className="h-4 w-full max-w-2xl" />
                </CardHeader>
                <CardContent className="space-y-4 py-5">
                    <div className="flex flex-col gap-2 xl:flex-row">
                        <Skeleton className="h-10 flex-1" />
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-10 w-full sm:w-24" />
                            ))}
                        </div>
                    </div>
                    <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
                {Array.from({ length: 2 }).map((_, sectionIndex) => (
                    <Card key={sectionIndex} className="gap-0 py-0">
                        <CardHeader className="border-b border-border/60 py-4 sm:py-4">
                            <Skeleton className="h-6 w-44" />
                            <Skeleton className="h-4 w-64 max-w-full" />
                        </CardHeader>
                        <CardContent className="space-y-0 px-0">
                            {Array.from({ length: 3 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-4 last:border-b-0">
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <Skeleton className="h-4 w-2/3" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                    <Skeleton className="h-8 w-24" />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 rounded-lg" />
                ))}
            </div>
        </div>
    );
}
