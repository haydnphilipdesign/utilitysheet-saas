import { describe, expect, it } from 'vitest';
import {
    classifyAdminWorkspace,
    getAdminWorkspaceKindLabel,
} from '@/lib/admin/workspace-classification';

describe('admin workspace classification', () => {
    it('uses Team billing as the Team organization signal', () => {
        const kind = classifyAdminWorkspace({ subscriptionStatus: 'team', memberCount: 1 });
        expect(kind).toBe('team_organization');
        expect(getAdminWorkspaceKindLabel(kind)).toBe('Team organization');
    });

    it('does not present single-member default workspaces as Team adoption', () => {
        const kind = classifyAdminWorkspace({ subscriptionStatus: 'free', memberCount: 1 });
        expect(kind).toBe('personal_workspace');
        expect(getAdminWorkspaceKindLabel(kind)).toBe('Personal/default workspace');
    });

    it('recognizes non-Team workspaces with multiple members without calling them Team organizations', () => {
        expect(classifyAdminWorkspace({ subscriptionStatus: 'free', memberCount: 2 })).toBe('shared_workspace');
    });
});
