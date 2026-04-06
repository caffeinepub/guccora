/**
 * firestorePayments.ts
 *
 * Central helper for the "payments" Firestore collection.
 * All data is stored in Firestore — no localStorage.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
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
  createdAt: number;
};

/**
 * Save a new payment to the "payments" Firestore collection.
 * Matches the exact structure requested:
 * { userId, name, phone, planAmount, status: "pending", createdAt: Date.now() }
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
      createdAt: Date.now(),
    });
    return { success: true, docId: docRef.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Approve a payment:
 * 1. updateDoc payment: status = "approved"
 * 2. Find and updateDoc user: isActive=true, paidUser=true, + income increments
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

    let userRef = null as ReturnType<typeof doc> | null;

    if (userId) {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (userSnap.exists()) {
        userRef = doc(db, "users", userId);
      }
    }

    // Fallback: query by phone
    if (!userRef && phone) {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const qs = await getDocs(q);
      if (!qs.empty) {
        userRef = doc(db, "users", qs.docs[0].id);
      }
    }

    if (!userRef) {
      return {
        success: true,
        error: "User not found but payment marked approved",
      };
    }

    // Step 4: fetch current user values to avoid null errors
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const currentDirectIncome = (userData.directIncome as number) || 0;
    const currentLevelIncome = (userData.levelIncome as number) || 0;
    const currentPairIncome = (userData.pairIncome as number) || 0;
    const currentWallet = (userData.wallet as number) || 0;

    // Step 5: updateDoc user — isActive: true, paidUser: true, income increments
    await updateDoc(userRef, {
      isActive: true,
      paidUser: true,
      planStatus: "active",
      planActive: true,
      selectedPlan: paymentData.planAmount || 0,
      planId: String(paymentData.planAmount || 0),
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
 * Reject a payment — set status = "rejected"
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
