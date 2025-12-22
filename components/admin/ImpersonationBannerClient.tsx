'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { stopImpersonating } from '@/app/(admin)/admin/users/actions';

interface ImpersonationBannerClientProps {
    impersonatedUserName: string;
}

export function ImpersonationBannerClient({ impersonatedUserName }: ImpersonationBannerClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleStopImpersonating = () => {
        startTransition(async () => {
            await stopImpersonating();
            router.push('/admin/users');
            router.refresh();
        });
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 to-orange-500 text-black py-3 px-4 shadow-lg">
            <div className="mx-auto max-w-7xl flex items-center justify-center gap-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">
                    You are impersonating: <span className="font-bold">{impersonatedUserName}</span>
                </span>
                <Button
                    size="sm"
                    variant="outline"
                    className="bg-white/90 hover:bg-white text-black border-black/20 ml-2"
                    onClick={handleStopImpersonating}
                    disabled={isPending}
                >
                    {isPending ? (
                        <span className="flex items-center gap-2">
                            <span className="h-3 w-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            Stopping...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <X className="h-4 w-4" />
                            Stop Impersonating
                        </span>
                    )}
                </Button>
            </div>
        </div>
    );
}
