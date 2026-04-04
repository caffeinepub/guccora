/**
 * mlmFunctions.ts
 *
 * Thin wrappers around Firebase Cloud Functions.
 * All MLM income calculation happens server-side.
 * The frontend NEVER calculates or writes income directly.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

type ApproveOrderResult = {
  success: boolean;
  incomeDistributed: boolean;
};

/**
 * Call the `approveOrder` Cloud Function.
 * The function handles:
 *   - Order status update (pending → approved)
 *   - Admin wallet credit
 *   - Direct income ₹40 to sponsor
 *   - Level income ₹5 × 10 levels
 *   - Pair income ₹3 per match × 10 levels
 *   - All transaction logging
 *   - Duplicate prevention via isIncomeGiven flag
 *
 * @param orderId - Firestore order document ID
 * @returns Promise<ApproveOrderResult>
 * @throws If the function fails or order is already approved
 */
export async function callApproveOrder(
  orderId: string,
): Promise<ApproveOrderResult> {
  const fn = httpsCallable<{ orderId: string }, ApproveOrderResult>(
    functions,
    "approveOrder",
  );
  const result = await fn({ orderId });
  return result.data;
}
