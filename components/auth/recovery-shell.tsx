import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import styles from './recovery-shell.module.css';

export function RecoveryShell({ children }: { children: ReactNode }) {
    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-background px-4 py-8 sm:p-4">
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-primary/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 shadow-lg shadow-slate-500/20">
                        <Image src="/logo-sm.png" alt="UtilitySheet Logo" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8" />
                    </div>
                    <span className="text-2xl sm:text-3xl font-bold text-foreground">UtilitySheet</span>
                </div>

                <Card className="border-border bg-card/80 backdrop-blur-xl shadow-2xl">
                    <CardContent className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className={styles.content}>{children}</div>
                        <div className="mt-6 border-t border-border pt-4 text-center">
                            <Link href="/auth/login" className="text-sm text-primary hover:text-primary/80 hover:underline focus-visible:underline">
                                Back to sign in
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <p className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-muted-foreground px-4">
                    By continuing, you agree to our{' '}
                    <Link href="/terms" className="hover:text-foreground underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="hover:text-foreground underline">Privacy Policy</Link>
                </p>
            </div>
        </div>
    );
}
