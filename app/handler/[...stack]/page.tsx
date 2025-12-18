import { StackHandler } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack/server";

export default function Handler(props: { params: Promise<{ stack: string[] }> }) {
    return <StackHandler fullPage={true} app={stackServerApp} {...props} />;
}
