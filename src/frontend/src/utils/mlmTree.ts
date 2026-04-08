/**
 * mlmTree.ts — MLM binary tree helpers (Firestore-backed).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

export type UserStatus = "active" | "inactive" | "hold";

export type FirestoreUser = {
  id: string;
  name: string;
  phone: string;
  password: string;
  sponsorId: string | null;
  position: "left" | "right" | null;
  parentId: string | null;
  leftChild: string | null;
  rightChild: string | null;
  wallet: number;
  directIncome: number;
  levelIncome: number;
  pairIncome: number;
  leftCount: number;
  rightCount: number;
  referralCode: string;
  isActive: boolean;
  userStatus: UserStatus;
  referredBy?: string | null;
  paidUser?: boolean;
  createdAt: number;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

export async function getUserByReferralCode(
  referralCode: string,
): Promise<FirestoreUser | null> {
  try {
    const q = query(
      collection(db, "users"),
      where("referralCode", "==", referralCode),
    );
    const snap = await withTimeout(getDocs(q), 5000);
    if (snap.empty) return null;
    return snap.docs[0].data() as FirestoreUser;
  } catch {
    return null;
  }
}

export async function findAvailableSlot(
  rootId: string,
  preferredPosition: "left" | "right",
): Promise<{ parentId: string; position: "left" | "right" }> {
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    let currentDoc: FirestoreUser | null = null;
    try {
      const snap = await withTimeout(getDoc(doc(db, "users", currentId)), 5000);
      if (snap.exists()) currentDoc = snap.data() as FirestoreUser;
    } catch {
      // ignore
    }
    if (!currentDoc) continue;

    if (preferredPosition === "left" && !currentDoc.leftChild) {
      return { parentId: currentId, position: "left" };
    }
    if (preferredPosition === "right" && !currentDoc.rightChild) {
      return { parentId: currentId, position: "right" };
    }
    if (preferredPosition === "left" && !currentDoc.rightChild) {
      return { parentId: currentId, position: "right" };
    }
    if (preferredPosition === "right" && !currentDoc.leftChild) {
      return { parentId: currentId, position: "left" };
    }

    if (currentDoc.leftChild) queue.push(currentDoc.leftChild);
    if (currentDoc.rightChild) queue.push(currentDoc.rightChild);
  }

  return { parentId: rootId, position: preferredPosition };
}

export async function placeUserInTree(
  newUserId: string,
  sponsorId: string,
  preferredPosition: "left" | "right",
): Promise<{ parentId: string; position: "left" | "right" }> {
  const { parentId, position } = await findAvailableSlot(
    sponsorId,
    preferredPosition,
  );
  try {
    const field = position === "left" ? "leftChild" : "rightChild";
    await withTimeout(
      updateDoc(doc(db, "users", parentId), { [field]: newUserId }),
      5000,
    );
  } catch {
    // ignore
  }
  return { parentId, position };
}
