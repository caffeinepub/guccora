# GUCCORA

## Current State
- PLANS array in GuccoraContext.tsx has incorrect income rates (Silver plan missing, pair income values wrong)
- `selectedPlan` type only covers `599 | 1999 | 2999` (missing `999`)
- `markUserPaid` only accepts `599 | 1999 | 2999`
- `REFERRAL_COMMISSION` map missing `999` entry
- WalletPage shows income breakdown but does not display per-plan rate reference or pair income earning rate
- AdminPage approval logic already reads from PLANS so will auto-correct once PLANS is fixed

## Requested Changes (Diff)

### Add
- Per-plan income rate reference table in WalletPage (shows what the user earns per plan)
- `999` as a valid plan in all type unions
- `REFERRAL_COMMISSION` entry for `999` plan (₹70 direct = use ₹70 commission)

### Modify
- `PLANS` income rates:
  - ₹599: directIncome=40, levelIncome=5, pairIncome=30, levels=10
  - ₹999: directIncome=70, levelIncome=8, pairIncome=50, levels=10
  - ₹1999: directIncome=140, levelIncome=16, pairIncome=100, levels=10
  - ₹2999: directIncome=210, levelIncome=24, pairIncome=150, levels=10
- `selectedPlan` type → `599 | 999 | 1999 | 2999 | null`
- `markUserPaid` signature → accepts `599 | 999 | 1999 | 2999`
- WalletPage: update description text to reflect ₹70–₹210 range instead of ₹100–₹500
- WalletPage: add income plan breakdown card showing the user's plan rates

### Remove
- Nothing removed

## Implementation Plan
1. Update `PLANS` array with correct income rates in GuccoraContext.tsx
2. Update `selectedPlan` type union to include `999` everywhere
3. Update `markUserPaid` to accept `999`, update `REFERRAL_COMMISSION` to include `999: 70`
4. Update WalletPage to show a plan-based income breakdown card (rates for current plan)
5. AdminPage already reads `matchedPlan?.directIncome` from PLANS — will auto-correct
