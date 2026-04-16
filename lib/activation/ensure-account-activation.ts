import 'server-only';

import type { BrandProfile, Organization } from '@/types';
import {
    createBrandProfile,
    createOrganization,
    ensureAccountRecord,
    ensureIntakeLink,
    getAccountById,
    getAccountOrganizations,
    getBrandProfiles,
    getDefaultBrandProfile,
    setActiveOrganization,
} from '@/lib/neon/queries';

type AuthUserLike = {
    id: string;
    primaryEmail?: string | null;
    displayName?: string | null;
    signedUpAt?: Date | string | null;
};

type ActivationFlags = {
    accountCreated: boolean;
    organizationCreated: boolean;
    organizationAssigned: boolean;
    brandProfileCreated: boolean;
    intakeLinkCreated: boolean;
    defaultsProvisioned: boolean;
};

type EnsureActivationResult = {
    account: NonNullable<Awaited<ReturnType<typeof getAccountById>>>;
    organizations: Organization[];
    activeOrganization: Organization | null;
    defaultBrandProfile: BrandProfile | null;
    activation: ActivationFlags;
};

function titleCaseWord(word: string) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function nameFromEmailLocalPart(email?: string | null) {
    const localPart = email?.split('@')[0]?.trim();
    if (!localPart) return null;

    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return null;

    return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .map(titleCaseWord)
        .join(' ');
}

function deriveWorkspaceName(user: AuthUserLike) {
    const displayName = user.displayName?.trim();
    if (displayName) {
        return displayName;
    }

    const emailName = nameFromEmailLocalPart(user.primaryEmail);
    if (emailName) {
        return emailName;
    }

    return 'My Workspace';
}

export async function ensureAccountActivation(user: AuthUserLike): Promise<EnsureActivationResult | null> {
    const ensuredAccount = await ensureAccountRecord(
        user.id,
        user.primaryEmail || '',
        user.displayName || undefined,
        user.signedUpAt || null
    );
    if (!ensuredAccount.account) {
        return null;
    }

    let account = ensuredAccount.account;
    const activation: ActivationFlags = {
        accountCreated: ensuredAccount.created,
        organizationCreated: false,
        organizationAssigned: false,
        brandProfileCreated: false,
        intakeLinkCreated: false,
        defaultsProvisioned: false,
    };

    let organizations = (await getAccountOrganizations(account.id)) as Organization[];
    let activeOrganization = organizations.find((organization) => organization.id === account.active_organization_id) || null;

    if (!activeOrganization && organizations.length > 0) {
        const nextActiveOrganization = organizations[0];
        const updatedAccount = await setActiveOrganization(account.id, nextActiveOrganization.id);
        if (updatedAccount) {
            account = updatedAccount;
        }
        activeOrganization = nextActiveOrganization;
        activation.organizationAssigned = true;
    }

    if (!activeOrganization && organizations.length === 0) {
        const accountScopedProfiles = await getBrandProfiles(account.id);
        if (accountScopedProfiles.length === 0) {
            const createdOrganization = await createOrganization(deriveWorkspaceName(user), account.id);
            if (createdOrganization) {
                activation.organizationCreated = true;
                const updatedAccount = await getAccountById(account.id);
                if (updatedAccount) {
                    account = updatedAccount;
                }
                organizations = (await getAccountOrganizations(account.id)) as Organization[];
                activeOrganization =
                    organizations.find((organization) => organization.id === createdOrganization.id) ||
                    (createdOrganization as Organization);
            }
        }
    }

    let defaultBrandProfile = await getDefaultBrandProfile(account.id, activeOrganization?.id || undefined);
    if (!defaultBrandProfile) {
        defaultBrandProfile = await createBrandProfile({
            accountId: account.id,
            organizationId: activeOrganization?.id,
            name: activeOrganization?.name || deriveWorkspaceName(user),
            primaryColor: '#10b981',
            secondaryColor: '#059669',
            contactName: account.full_name || user.displayName || undefined,
            contactEmail: account.email || user.primaryEmail || undefined,
            contactPhone: account.phone || undefined,
            isDefault: true,
        });
        activation.brandProfileCreated = Boolean(defaultBrandProfile);
    }

    const intakeLinkResult = await ensureIntakeLink(account.id);
    activation.intakeLinkCreated = Boolean(intakeLinkResult?.created);
    activation.defaultsProvisioned = Boolean(
        activeOrganization &&
        defaultBrandProfile &&
        intakeLinkResult?.intakeLink &&
        (
            activation.organizationCreated ||
            activation.organizationAssigned ||
            activation.brandProfileCreated ||
            activation.intakeLinkCreated
        )
    );

    return {
        account,
        organizations,
        activeOrganization,
        defaultBrandProfile,
        activation,
    };
}
