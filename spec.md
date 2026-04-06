# GUCCORA

## Current State
Admin panel has two approval flows:
1. **Payments tab** (`handleApproveFirestorePayment`) — approves UTR/screenshot submissions
2. **Orders tab** (`handleApprove`) — approves pending orders

Both flows previously used `sponsorId` + `position` + `leftCount`/`rightCount` fields for MLM income, which is incompatible with the user registration structure that stores `referredBy` (referral code), `directCount`, and `pairPaid`.

## Requested Changes (Diff)

### Add
- `src/frontend/src/utils/mlmApproval.ts` — new shared `applyFullMLMApproval()` function implementing the full MLM logic using `referredBy`, `directCount`, and `pairPaid` fields:
  - Direct income to sponsor (via `referredBy` code)
  - Level income × 10 levels up the `referredBy` chain
  - Pair income (every 2 directs = 1 pair, `pairPaid` tracks how many pairs already credited)
  - Admin wallet update (simple number in `adminWallet` key)
  - Order added to `localStorage["orders"]` with full fields
  - Payment marked approved in `localStorage["payments"]`

### Modify
- `AdminPage.tsx` — both `handleApprove` and `handleApproveFirestorePayment` now call `applyFullMLMApproval()` instead of inline income logic
- `AdminPage.tsx` — `adminWalletBalance` now reads from `adminWallet` key (simple number) first, then falls back to `guccora_admin_wallet` object

### Remove
- Inline `sponsorId`/`leftCount`/`rightCount`/`position`-based income logic from both approval functions

## Implementation Plan
1. Create `mlmApproval.ts` with `applyFullMLMApproval(payment)` — full MLM logic
2. Import and use `applyFullMLMApproval` in `handleApprove` (OrdersTab)
3. Import and use `applyFullMLMApproval` in `handleApproveFirestorePayment` (AdminPage)
4. Update `adminWalletBalance` to read from `adminWallet` localStorage key
