/**
 * Shared class fragments for the seller wizard so buttons, chips, and inputs
 * keep identical interaction states (hover, focus-visible, active) across
 * every step. All colors flow through the brand accent CSS variables set by
 * SellerLayout (lib/branding/deliverable.ts), so agent branding applies
 * everywhere automatically. Text, icons and focus rings use the
 * contrast-checked `--brand-accent-text`; solid buttons use
 * `--brand-accent-fill` with `--brand-accent-contrast` text.
 */

/** On the element that carries the brand variables: picks the light or dark accent ink. */
export const wizardBrandScope =
    '[--brand-accent-text:var(--brand-accent-ink)] dark:[--brand-accent-text:var(--brand-accent-ink-dark)]';

export const wizardFocusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-accent-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Solid brand fill with a text color that meets contrast on it. */
export const wizardAccentFill =
    'bg-[color:var(--brand-accent-fill)] text-[color:var(--brand-accent-contrast)]';

export const wizardPrimaryButton =
    `${wizardAccentFill} hover:bg-[color:var(--brand-accent-strong)] rounded-xl font-medium transition-colors active:scale-[0.98] ${wizardFocusRing}`;

export const wizardSecondaryButton =
    `bg-muted/40 border border-border text-foreground hover:bg-muted rounded-xl font-medium transition-colors active:scale-[0.98] ${wizardFocusRing}`;

export const wizardGhostButton =
    `text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98] rounded-lg ${wizardFocusRing}`;

export const wizardTextInput =
    'w-full bg-muted/50 border border-border rounded-xl text-foreground placeholder:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-accent-border)] focus:border-[color:var(--brand-accent-border)]';
