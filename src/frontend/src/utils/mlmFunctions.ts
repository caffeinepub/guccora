/**
 * mlmFunctions.ts — thin wrappers around Firebase Cloud Functions.
 */
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

type ApproveOrderResult = {
  success: boolean;
  incomeDistributed: boolean;
};

/**
 * callApproveOrder — calls the `approveOrder` Cloud Function.
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
