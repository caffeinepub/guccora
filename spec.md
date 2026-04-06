# GUCCORA — Manual Payment Verification (UTR + Screenshot)

## Current State

- `PlansPage.tsx`: Each plan card has a "Pay via UPI" button (deep link) and an "I have paid — Confirm Payment" button. Clicking confirm immediately calls `markUserPaid()` which activates the plan in Firestore without any admin verification.
- `GuccoraContext.tsx`: Has `submitPaymentRequest(planId, upiRef, screenshotUrl)` function and `PaymentRequest` type (fields: id, planId, upiRef, screenshotUrl, status, timestamp) already defined. `adminApprovePayment` and `adminRejectPayment` exist in context.
- `AdminPage.tsx`: Has a Payments tab that shows `userData.paymentRequests` with Approve/Reject buttons per request. Currently shows `UPI Ref` field per payment, but no screenshot display.
- The `PaymentRequest` type already has `screenshotUrl` and `upiRef` fields.
- The current "I have paid" button calls `markUserPaid()` directly — bypasses the admin approval flow entirely.

## Requested Changes (Diff)

### Add
- UTR number text input on each plan card's "I have paid" section
- Screenshot file upload input on each plan card
- `submitPayment()` logic: reads UTR + file, converts screenshot to base64 via FileReader, calls existing `submitPaymentRequest(planId, utr, screenshotBase64)` — saves to Firestore `paymentRequests` collection
- Screenshot image display in Admin payments tab (thumbnail, clickable to expand)
- Admin approval triggers plan activation (already exists via `adminApprovePayment`) but must also save to Firestore for the approved user

### Modify
- Replace the single "I have paid — Confirm Payment" button on each plan card with an expanded form: UTR input + screenshot upload + Submit Payment button
- The submit action must NOT auto-activate the plan — it must call `submitPaymentRequest` and show a "Waiting for admin approval" message
- Admin payments tab: add screenshot thumbnail beside each payment request
- `submitPaymentRequest` in `GuccoraContext.tsx`: also persist the payment request to Firestore `paymentRequests` collection (keyed by userId + requestId) so admin can see it and approval persists across sessions
- `adminApprovePayment`: also update the user's Firestore document (`paidUser: true`, `selectedPlan`, `planStatus: active`) so approval persists

### Remove
- Direct `markUserPaid()` call from the "I have paid" button — plan must only activate after admin approval

## Implementation Plan

1. **`PlansPage.tsx`**: Replace the confirm-payment button with a collapsible/inline form per plan card containing:
   - `<input type="text">` for UTR number (placeholder: "Enter UTR Number")
   - `<input type="file" accept="image/*">` for screenshot
   - "Submit Payment" button that: validates both fields, reads file as DataURL, calls `submitPaymentRequest(product.id, utr, base64Screenshot)`, shows success toast "Payment submitted. Waiting for admin approval"
   - If plan already has a pending request: show "Pending admin approval" status instead of the form
   - Remove direct `markUserPaid()` call

2. **`GuccoraContext.tsx`** — `submitPaymentRequest`: add Firestore write to `paymentRequests` collection:
   ```
   setDoc(doc(db, "paymentRequests", req.id), { userId, ...req })
   ```
   Also add `adminApprovePayment` Firestore write to update approved user's document.

3. **`AdminPage.tsx`** — Payments tab: display screenshot as `<img>` thumbnail (40x40 rounded, click to open full-size in new tab) next to each payment request's UTR/ref info.

4. All state management uses existing `paymentRequests` array in `userData`. No new types needed — `PaymentRequest.upiRef` stores UTR, `PaymentRequest.screenshotUrl` stores base64.
