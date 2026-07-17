export type AdminWorkspaceKind = 'team_organization' | 'shared_workspace' | 'personal_workspace';

export function classifyAdminWorkspace(input: {
    subscriptionStatus?: string | null;
    memberCount?: number | string | null;
}): AdminWorkspaceKind {
    if (input.subscriptionStatus === 'team') return 'team_organization';
    if (Number(input.memberCount || 0) > 1) return 'shared_workspace';
    return 'personal_workspace';
}

export function getAdminWorkspaceKindLabel(kind: AdminWorkspaceKind) {
    if (kind === 'team_organization') return 'Team organization';
    if (kind === 'shared_workspace') return 'Shared workspace';
    return 'Personal/default workspace';
}
