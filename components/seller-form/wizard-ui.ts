/**
 * Shared class fragments for the seller wizard so buttons, chips, and inputs
 * keep identical interaction states (hover, focus-visible, active) across
 * every step. All colors flow through the brand accent CSS variables set by
 * SellerLayout, so agent branding applies everywhere automatically.
 */

export const wizardFocusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const wizardPrimaryButton =
    `bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-strong)] text-white rounded-xl font-medium transition-colors active:scale-[0.98] ${wizardFocusRing}`;

export const wizardSecondaryButton =
    `bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors active:scale-[0.98] ${wizardFocusRing}`;

export const wizardGhostButton =
    `text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98] rounded-lg ${wizardFocusRing}`;

export const wizardTextInput =
    'w-full bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent-border)] focus:border-[color:var(--brand-accent-border)]';
