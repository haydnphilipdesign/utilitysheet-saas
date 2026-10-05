import { ExternalLink } from 'lucide-react';
import type { BillingEvidence as Evidence, StripeMode, StripeRecordLink } from '@/lib/admin/billing-context';

/**
 * Read-only billing evidence for Admin detail pages. Server-rendered; Stripe
 * identifiers are shown to admins only and never fetched or modified here.
 */
export function BillingEvidence({
    evidence,
    links,
    mode,
}: {
    evidence: Evidence;
    links: StripeRecordLink[];
    mode: StripeMode | null;
}) {
    return (
        <div className="space-y-3 text-sm">
            <div>
                <span className="block text-xs text-muted-foreground">Stored billing evidence</span>
                <span className={evidence.tone === 'review' ? 'font-medium text-amber-700 dark:text-amber-300' : 'text-foreground'}>
                    {evidence.summary}
                </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{evidence.caveat}</p>

            {links.length > 0 ? (
                <ul className="space-y-1.5">
                    {links.map((link) => (
                        <li key={link.label} className="text-xs">
                            <span className="block text-muted-foreground">{link.label}</span>
                            {link.href ? (
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="inline-flex items-center gap-1 break-all font-mono text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {link.id}
                                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                                    <span className="sr-only">(opens Stripe {mode} dashboard)</span>
                                </a>
                            ) : (
                                <span className="break-all font-mono text-foreground">{link.id}</span>
                            )}
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground">No Stripe identifiers are stored.</p>
            )}

            <p className="text-xs text-muted-foreground">
                {links.length === 0
                    ? null
                    : mode
                        ? `Links open the Stripe ${mode} dashboard used by this environment. A record created in the other mode will not be found there.`
                        : 'Stripe dashboard links are unavailable because this environment’s Stripe mode could not be determined. Look the identifier up in Stripe directly.'}
            </p>
        </div>
    );
}
