import { Suspense } from "react";
import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack/server";
import { CustomOAuthCallback } from "@/components/auth/custom-oauth-callback";

async function StackHandlerContent(props: { params: Promise<{ stack: string[] }> }) {
    const { stack } = await props.params;
    if (stack?.[0] === "oauth-callback") {
        return <CustomOAuthCallback />;
    }
    return <StackHandler fullPage={true} app={stackServerApp} {...props} />;
}

function LoadingFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary via-background to-background">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Loading...</p>
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
