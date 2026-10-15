import { Suspense } from "react";
import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack/server";
import { CustomOAuthCallback } from "@/components/auth/custom-oauth-callback";
import { RecoveryShell } from "@/components/auth/recovery-shell";

async function StackHandlerContent(props: { params: Promise<{ stack: string[] }> }) {
    const { stack } = await props.params;
    if (stack?.[0] === "oauth-callback") {
        return <CustomOAuthCallback />;
    }
    if (stack?.length === 1 && (stack[0] === "forgot-password" || stack[0] === "password-reset")) {
        return (
            <RecoveryShell>
                <StackHandler fullPage={false} app={stackServerApp} {...props} />
            </RecoveryShell>
        );
    }
    return <StackHandler fullPage={true} app={stackServerApp} {...props} />;
}

function LoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Loading…</p>
            </div>
        </div>
    );
}

export default function Handler(props: { params: Promise<{ stack: string[] }> }) {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <StackHandlerContent {...props} />
        </Suspense>
    );
}
