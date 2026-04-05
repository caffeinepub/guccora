# GUCCORA

## Current State
- Admin Users tab has only Activate/Deactivate toggle (2 states)
- `adminToggleUserActive()` flips `isActive` boolean — no "Hold" state
- `logout()` calls `saveUserToUsersArray` with `isActive: userData.isActive` — persists status correctly but logic in `login()` sets `isActive` from `foundUser.isActive` — if `isActive` was false it stays false, so status does survive logout already; however the FirestoreUsersSection only shows Delete button, no status controls
- `UserData.isActive` is boolean — no concept of "hold"
- In `GuccoraContext.tsx` the `FirestoreUser` type in `mlmTree.ts` (used in users array) only has `isActive: boolean`
- Admin order approval in `AdminPage.tsx` does run MLM income distribution in the localStorage fallback, BUT income rates are hardcoded to Starter values (₹40 direct, ₹5 level, ₹3 pair) regardless of product amount/plan
- The localStorage MLM income code does iterate upline for level/pair income correctly
- `login()` sets `isActive` from `foundUser.isActive`, so status persists; but there's no "hold" status displayed on user side
- `FirestoreUsersSection` in AdminPage shows users but only with Delete button — no Active/Inactive/Hold buttons

## Requested Changes (Diff)

### Add
- Three-state user status: `"active" | "inactive" | "hold"` (replaces boolean `isActive`)
- Admin status buttons per user in FirestoreUsersSection: Active (green), Inactive (red), Hold (yellow)
- `userStatus` field stored in the `users` localStorage array
- Status badge showing "Hold" (yellow) alongside Active/Inactive in admin and user dashboards
- `adminSetUserStatus(userId, status)` function in context replacing `adminToggleUserActive`

### Modify
- `FirestoreUser` type in mlmTree.ts: add `userStatus?: "active" | "inactive" | "hold"`
- `UserData` type: change `isActive: boolean` → keep for backward compat but add `userStatus: "active" | "inactive" | "hold"`
- `createEmptyData()`: default `userStatus: "inactive"`
- `login()`: restore `userStatus` from saved user record; set `isActive` from `userStatus === "active"`
- `logout()`: save `userStatus` to users array before clearing session — do NOT change status
- `saveUserToUsersArray()`: include `userStatus` in saved fields
- `AdminPage.tsx` FirestoreUsersSection: add Active/Inactive/Hold buttons per user row
- `AdminPage.tsx` legacy User Management: replace Toggle with 3-button status selector
- `StatusBadge`: add `hold` variant (yellow)
- MLM income distribution: use actual plan rates based on order amount instead of hardcoded Starter rates
- `addOrder()` in context: do NOT set `isActive: true` immediately — only admin approval should activate

### Remove
- `adminToggleUserActive` function (replaced by `adminSetUserStatus`)
- Hardcoded Starter-plan income rates in AdminPage order approval fallback

## Implementation Plan
1. Update `FirestoreUser` type in `mlmTree.ts` to add `userStatus`
2. Update `UserData` type and `createEmptyData` in `GuccoraContext.tsx`
3. Add `adminSetUserStatus` to context, remove `adminToggleUserActive`
4. Fix `logout()` to save `userStatus` field
5. Fix `login()` to restore `userStatus` field
6. Fix `addOrder()` to NOT auto-activate user
7. Update `AdminPage.tsx` FirestoreUsersSection with 3-button status controls
8. Update AdminPage legacy user management section
9. Fix MLM income rates in order approval to use plan-based rates
10. Update StatusBadge to support hold state
