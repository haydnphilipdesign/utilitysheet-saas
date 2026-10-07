import { getAccountById, getAccountOrganizations } from '@/lib/neon/queries';
import type { IntakeLink } from '@/lib/neon/queries/intake-links';

/**
 * Who a public link's requests go to and which plan applies. A shared form
 * depends on its current owner, a personal form on its creator.
 */
export async function publicFormScope(form: IntakeLink) {
    const account = await getAccountById(
        form.shared_owner_account_id || form.account_id,
    );
    if (
        !account ||
        account.role === 'banned' ||
        (account.closure_status && account.closure_status !== 'active')
    )
        return null;
    const organizations = (await getAccountOrganizations(account.id)) as Array<{
        id: string;
        subscription_status?: string | null;
    }>;
    const organization = form.organization_id
        ? organizations.find((o) => o.id === form.organization_id)
        : null;
    if (form.organization_id && !organization) return null;
    return {
        account,
        organization,
        isPaid:
            account.subscription_status === 'pro' ||
            organization?.subscription_status === 'team',
    };
}
