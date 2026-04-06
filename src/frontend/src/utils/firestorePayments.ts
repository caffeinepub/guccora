/**
 * firestorePayments.ts
 *
 * Central helper for the "payments" Firestore collection.
 * Handles:
 *   - Saving a new payment request (user side)
 *   - Approving a payment (admin side):
 *     - updateDoc payment status to "approved"
 *     - updateDoc user: isActive=true, paidUser=true
 *     - increment directIncome += 120, levelIncome += 15, pairIncome += 30
 *     - increment wallet += (120 + 15 + 30) = 165
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

// Fixed income amounts per requirement
const DIRECT_INCOME_AMOUNT = 120;
const LEVEL_INCOME_AMOUNT = 15;
const PAIR_INCOME_AMOUNT = 30;
const TOTAL_INCOME =
  DIRECT_INCOME_AMOUNT + LEVEL_INCOME_AMOUNT + PAIR_INCOME_AMOUNT; // 165

export type FirestorePayment = {
  id: string;
  userId: string;
  name: string;
  phone: string;
  planAmount: number;
  UTR: string;
  screenshot: string;
  status: "pending" | "approved" | "rejected";
  createdAt: unknown;
};

/**
 * Save a new payment to the "payments" Firestore collection.
 * Fields: userId, name, phone, planAmount, UTR, screenshot, status="pending", createdAt
 */
export async function savePaymentToFirestore(params: {
  userId: string;
  name: string;
  phone: string;
  planAmount: number;
  UTR: string;
  screenshot: string;
}): Promise<{ success: boolean; docId?: string; error?: string }> {
  try {
    const docRef = await addDoc(collection(db, "payments"), {
      userId: params.userId,
      name: params.name,
      phone: params.phone,
      planAmount: params.planAmount,
      UTR: params.UTR,
      screenshot: params.screenshot,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { success: true, docId: docRef.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Approve a payment:
 * 1. updateDoc payment: status = "approved"
 * 2. Find and updateDoc user: isActive=true, paidUser=true, directIncome+=120, levelIncome+=15, pairIncome+=30, wallet+=165
 */
export async function approveFirestorePayment(paymentDocId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Step 1: fetch the payment doc
    const paymentRef = doc(db, "payments", paymentDocId);
    const paymentSnap = await getDoc(paymentRef);

    if (!paymentSnap.exists()) {
      return { success: false, error: "Payment document not found" };
    }

    const paymentData = paymentSnap.data();

    // Duplicate protection
    if (paymentData.status === "approved") {
      return { success: false, error: "Already approved" };
    }

    // Step 2: update payment status to "approved"
    await updateDoc(paymentRef, { status: "approved" });

    // Step 3: find the user by userId or phone
    const userId = paymentData.userId as string;
    const phone = paymentData.phone as string;

    let userDocId = "";
    let userRef = null as ReturnType<typeof doc> | null;

    if (userId) {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (userSnap.exists()) {
        userDocId = userId;
        userRef = doc(db, "users", userId);
      }
    }

    // Fallback: query by phone
    if (!userRef && phone) {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const qs = await getDocs(q);
      if (!qs.empty) {
        userDocId = qs.docs[0].id;
        userRef = doc(db, "users", userDocId);
      }
    }

    if (!userRef) {
      // Payment marked approved, but user not found in Firestore — partial success
      return {
        success: true,
        error: "User not found but payment marked approved",
      };
    }

    // Step 4: fetch current user values to avoid null errors
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    // Use (value || 0) pattern — increment() handles null-safe addition in Firestore
    const currentDirectIncome = userData.directIncome || 0;
    const currentLevelIncome = userData.levelIncome || 0;
    const currentPairIncome = userData.pairIncome || 0;
    const currentWallet = userData.wallet || 0;

    // Step 5: updateDoc user with income and activation
    await updateDoc(userRef, {
      isActive: true,
      paidUser: true,
      planStatus: "active",
      planActive: true,
      selectedPlan: paymentData.planAmount || 0,
      directIncome: currentDirectIncome + DIRECT_INCOME_AMOUNT,
      levelIncome: currentLevelIncome + LEVEL_INCOME_AMOUNT,
      pairIncome: currentPairIncome + PAIR_INCOME_AMOUNT,
      wallet: currentWallet + TOTAL_INCOME,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Reject a payment — just set status = "rejected"
 */
export async function rejectFirestorePayment(paymentDocId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await updateDoc(doc(db, "payments", paymentDocId), {
      status: "rejected",
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
