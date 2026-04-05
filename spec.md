# GUCCORA — Razorpay 3-Plan System + Tiered Referral Rewards

## Current State
- PlansPage has a single ₹599 hero plan section plus a dynamic product grid. The hero plan uses `markUserPaid()` which always credits referrer ₹100.
- WalletPage shows wallet balance, referral code, referred users list, MLM income, and withdrawal.
- GuccoraContext `markUserPaid()` takes no arguments and hardcodes ₹100 referral reward.
- UserData type has `paidUser: boolean` but no `selectedPlan` field.

## Requested Changes (Diff)

### Add
- 3 fixed plan buttons on PlansPage: Join ₹599 Plan, Join ₹1999 Plan, Join ₹2999 Gold Plan
- Each redirects to its Razorpay link on click
- `selectedPlan` field (599 | 1999 | 2999 | null) on UserData, stored in Firestore
- Tiered referral commission: ₹599→₹100, ₹1999→₹300, ₹2999→₹500
- `markUserPaid(planAmount: number)` accepts plan amount, uses tiered commission
- WalletPage: show "My Plan" section displaying active plan name
- WalletPage: team members section showing referred users count and list

### Modify
- `markUserPaid()` signature → `markUserPaid(planAmount: number)` with tiered commission logic
- PlansPage hero section replaced with 3-plan card grid
- WalletPage referral note updated to show correct commission per plan
- GuccoraContext type definition for `markUserPaid`
- UserData type: add `selectedPlan?: 599 | 1999 | 2999 | null`

### Remove
- Old single-plan ₹599 hero section on PlansPage (replaced by 3-plan layout)

## Implementation Plan
1. Update `UserData` type to add `selectedPlan` field
2. Update `createEmptyData()` to include `selectedPlan: null`
3. Update `markUserPaid` signature and logic in GuccoraContext — accept `planAmount`, compute commission from map, save `selectedPlan` + `paidUser` to Firestore, credit tiered commission to referrer
4. Update `GuccoraContextType` interface for new signature
5. Rewrite PlansPage to show 3 plan cards with correct links and `confirmPayment(planAmount)` flow
6. Update WalletPage to show "My Plan" badge and clearer team section with per-plan commission note
