import 'server-only';

import { getOrganizationById, getOrganizationMemberRole } from '@/lib/neon/queries/organizations';

type AccountOrganizationContext = {
    id?: unknown;
    active_organization_id?: unknown;
};

export async function canAccessOwnedOrActiveOrganizationResource(
    account: AccountOrganizationContext,
    resource: { account_id?: string | null; organization_id?: string | null },
) {
    const accountId = typeof account.id === 'string' ? account.id : null;
    const activeOrganizationId = typeof account.active_organization_id === 'string'
        ? account.active_organization_id
        : null;
    if (!accountId) return false;
    if (resource.organization_id) {
        if (resource.organization_id !== activeOrganizationId) return false;
        return Boolean(await getOrganizationMemberRole(resource.organization_id, accountId));
    }
    return resource.account_id === accountId;
}

/**
 * A workspace row as the browser may see it. The Stripe identifiers stay on
 * the server: no screen uses them, and members have no business with them.
 */
export function toClientOrganization<T extends Record<string, unknown>>(
    organization: T,
): Omit<T, 'stripe_customer_id' | 'subscription_id'> {
    const { stripe_customer_id: _customer, subscription_id: _subscription, ...rest } = organization;
    void _customer;
    void _subscription;
    return rest;
}

export async function getAuthorizedActiveOrganization(
    account: AccountOrganizationContext,
): Promise<(Record<string, unknown> & { role: 'admin' | 'member' }) | null> {
    const accountId = typeof account.id === 'string' ? account.id : null;
    const organizationId = typeof account.active_organization_id === 'string'
        ? account.active_organization_id
        : null;
    if (!organizationId || !accountId) return null;
    const role = await getOrganizationMemberRole(organizationId, accountId);
    if (!role) return null;
    const organization = await getOrganizationById(organizationId);
    return organization ? { ...(organization as Record<string, unknown>), role } : null;
}
