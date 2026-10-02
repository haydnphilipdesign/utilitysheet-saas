import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@stackframe/stack', () => ({ useUser: () => null }));
vi.mock('@/components/settings/account-security', () => ({ AccountSecuritySettings: () => null }));
vi.mock('@/components/referrals/referral-credit-card', () => ({ ReferralCreditCard: () => null }));
vi.mock('@/components/seller-forms/FormsWorkspace', () => ({ FormsWorkspace: () => <div data-testid="saved-forms">Seller forms management</div> }));
import SettingsPage from '@/app/dashboard/settings/page';
afterEach(() => { window.history.replaceState({}, '', '/'); });
it('keeps the Settings link deep link as the saved forms entry without a competing editor', () => {
    window.history.replaceState({}, '', '/dashboard/settings?tab=link');
    render(<SettingsPage />);
    expect(screen.getByTestId('saved-forms')).toBeVisible();
    expect(screen.queryByRole('button', { name: /save seller form/i })).not.toBeInTheDocument();
});
