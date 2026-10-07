import { sellerFormCreationCapability } from './config';

/** Existing paid status is resolved server-side for this fixed workspace. */
export function sellerFormCapabilities(
    accountId: string,
    isPaid: boolean,
    usage: number,
    totalUsage: number,
    /** Shared forms in the active workspace; absent outside a workspace. */
    shared?: { isTeams: boolean; usage: number; allowance: number },
) {
    const operational = sellerFormCreationCapability(accountId);
    const allowance = isPaid ? 10 : 1;
    const reason =
        usage >= allowance
            ? ('commercial' as const)
            : !operational.canCreate
              ? ('pilot' as const)
              : totalUsage >= operational.technicalCap!
                ? ('technical' as const)
                : null;
    const upgradeRequired = reason === 'commercial' && !isPaid;
    const message =
        reason === 'commercial'
            ? upgradeRequired
                ? 'Free includes one customizable form per workspace. Upgrade to Pro for up to ten.'
                : 'This workspace has reached its allowance of ten forms. Edit or reuse an existing form.'
            : reason === 'technical'
              ? 'The account form limit has been reached. Existing forms remain available.'
              : reason === 'pilot'
                ? 'Additional forms are temporarily unavailable for this account.'
                : '';
    return {
        canCreate: reason === null,
        reason,
        message,
        allowance,
        usage,
        totalUsage,
        upgradeRequired,
        pilotAvailable: operational.canCreate,
        sharing: {
            available: Boolean(shared?.isTeams),
            canShare: Boolean(shared?.isTeams) && shared!.usage < shared!.allowance,
            usage: shared?.usage ?? 0,
            allowance: shared?.allowance ?? 0,
            message: !shared?.isTeams
                ? 'Sharing a form with your team is part of the Teams plan.'
                : shared.usage >= shared.allowance
                  ? 'This workspace has shared as many forms as its plan allows. Stop sharing one first.'
                  : '',
        },
    };
}
export type SellerFormCapabilities = ReturnType<typeof sellerFormCapabilities>;
