# Implementation Plan - SaaS Platform Refinement

This plan addresses the recommendations from the platform analysis to elevate the application from "MVP" to "Polished V1".

## Goal Breakdown

### 1. Visual Polish: Dashboard Loading States
**Goal:** Replace the spinning loader with "Skeleton" UI placeholders to reduce layout shift and improve perceived performance.
*   **Target:** `app/dashboard/page.tsx`
*   **Action:** Implement `Skeleton` component for the stats cards and the requests table.

### 2. Resilience: Error Recovery & Retry
**Goal:** Prevent dead-ends for users when network glitches occur.
*   **Target:** `app/s/[token]/page.tsx`, `components/seller-form/SellerWizard.tsx`
*   **Action:** 
    *   Add a "Retry" button to the fatal error screen in the seller route.
    *   Ensure API calls in the wizard (e.g., submission) handle failures with a user-friendly "Try Again" toast or button.

### 3. User Insight: Feedback Loop
**Goal:** Capture qualitative data from early users.
*   **Features:**
    *   **Dashboard:** Add a "Feedback" button in the header or sidebar that opens a simple dialog or links to a form.
    *   **Seller Wizard:** Add a subtle "Report an issue" link in the footer.

### 4. Reliability: End-to-End Testing Foundation
**Goal:** Ensure the "Happy Path" never breaks.
*   **Action:** Install Playwright and create a basic test specification that covers:
    *   Public page loading.
    *   Seller wizard navigation (mocked).

---

## Proposed Changes

### Phase 1: Visual Polish (Dashboard Skeletons)

#### [NEW] [table-skeleton.tsx](file:///c:/Users/haydn/Documents/utility-sheet/components/ui/table-skeleton.tsx)
Create a reusable skeleton row component.

#### [MODIFY] [dashboard/page.tsx](file:///c:/Users/haydn/Documents/utility-sheet/app/dashboard/page.tsx)
- Import `Skeleton` and `TableSkeleton`.
- Replace `if (loading)` spinners with the skeleton structure.

### Phase 2: Error Recovery

#### [MODIFY] [app/s/[token]/page.tsx](file:///c:/Users/haydn/Documents/utility-sheet/app/s/[token]/page.tsx)
- Enhance the `error` state UI.
- Add a `handleRetry` function that re-triggers the data fetch.

### Phase 3: Feedback Loop

#### [NEW] [feedback-dialog.tsx](file:///c:/Users/haydn/Documents/utility-sheet/components/feedback-dialog.tsx)
A component using `Dialog` to capture text input.

#### [MODIFY] [dashboard/layout-content.tsx](file:///c:/Users/haydn/Documents/utility-sheet/app/dashboard/layout-content.tsx)
- Integrate `FeedbackDialog` into the header or user menu.

### Phase 4: Testing Logic
- Initialize Playwright (`npm init playwright@latest`).
- Add `tests/seller-flow.spec.ts`.

## Verification Plan

### Manual Verification
- **Dashboard:** Reload dashboard with network throttled to slow 3G to verify skeleton appearance.
- **Error:** Disconnect network, load seller page, verify "Retry" button appears. Reconnect, click Retry, verify success.
- **Feedback:** Open feedback modal, test submission behaviors.

### Automated Verification
- Run `npx playwright test` to verify the new test suite passes.
