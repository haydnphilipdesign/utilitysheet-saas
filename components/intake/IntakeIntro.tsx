import { Save, ShieldCheck } from 'lucide-react';
import {
    SELLER_PROGRESS_NOTE,
    defaultSellerHeading,
    defaultSellerIntro,
} from '@/lib/seller-forms/intro-copy';

interface IntakeIntroProps {
    brandName?: string | null;
    heading?: string | null;
    intro?: string | null;
    /** The editor preview is not the page's main heading. */
    headingAs?: 'h1' | 'p';
}

/**
 * Greeting at the top of a reusable seller link. Also rendered by the form
 * editor as its preview, so both always match. Needs the --brand-accent
 * variables from an ancestor.
 */
export function IntakeIntro({ brandName, heading, intro, headingAs: Heading = 'h1' }: IntakeIntroProps) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-[var(--brand-accent-soft)] p-2">
                <ShieldCheck className="h-5 w-5 text-[color:var(--brand-accent)]" />
            </div>
            <div className="min-w-0 space-y-1">
                <Heading className="text-xl font-semibold text-foreground break-words">
                    {heading?.trim() || defaultSellerHeading(brandName)}
                </Heading>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {intro?.trim() || defaultSellerIntro(brandName)}
                </p>
                <p className="inline-flex items-center gap-1.5 pt-1 text-xs text-muted-foreground/80">
                    <Save className="h-3 w-3" aria-hidden="true" />
                    {SELLER_PROGRESS_NOTE}
                </p>
            </div>
        </div>
    );
}
