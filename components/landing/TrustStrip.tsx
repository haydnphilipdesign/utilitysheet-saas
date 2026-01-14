import Link from 'next/link';

export function TrustStrip() {
    return (
        <section className="border-y border-border/50 bg-muted/20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        Built from real transaction coordination workflows.{' '}
                        <Link href="/about" className="underline underline-offset-4 hover:text-foreground">
                            Read the story
                        </Link>
                        .
                    </div>

                    <div className="flex items-center gap-4">
                        <img
                            src="/pa-real-estate-support.png"
                            alt="PA Real Estate Support Services, LLC"
                            className="h-8 w-auto dark:brightness-110"
                        />
                        <div className="text-sm">
                            <div className="font-semibold text-foreground leading-tight">PA Real Estate Support Services, LLC</div>
                            <div className="text-muted-foreground leading-tight">The TC business that inspired UtilitySheet</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

