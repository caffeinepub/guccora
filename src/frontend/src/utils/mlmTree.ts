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
  createdAt: number;
};

/** Wraps a promise with a timeout. Rejects with Error("timeout") if ms elapses first. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

/**
 * Find a user doc by their referralCode
 */
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

/**
 * BFS to find the next available slot under `rootId` for the given preferred position.
 * Returns { parentId, position } of the available slot.
 * If rootId itself has the preferred side empty, use it.
 * Otherwise BFS level-by-level and return first empty left or right.
 */
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
      // ignore — treat as missing node
    }
    if (!currentDoc) continue;

    // Check preferred position first
    if (preferredPosition === "left" && !currentDoc.leftChild) {
      return { parentId: currentId, position: "left" };
    }
    if (preferredPosition === "right" && !currentDoc.rightChild) {
      return { parentId: currentId, position: "right" };
    }
    // Check opposite position
    if (preferredPosition === "left" && !currentDoc.rightChild) {
      return { parentId: currentId, position: "right" };
    }
    if (preferredPosition === "right" && !currentDoc.leftChild) {
      return { parentId: currentId, position: "left" };
    }

    // Both filled — enqueue children
    if (currentDoc.leftChild) queue.push(currentDoc.leftChild);
    if (currentDoc.rightChild) queue.push(currentDoc.rightChild);
  }

  // Fallback — return root with preferred position (should not happen in practice)
  return { parentId: rootId, position: preferredPosition };
}

/**
 * Place a new user in the tree.
 * 1. Find the sponsor by sponsorId
 * 2. BFS to find available slot under sponsor
 * 3. Update parent's leftChild or rightChild in Firestore
 * Returns { parentId, position }
 */
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
    // ignore if offline or timed out
  }
  return { parentId, position };
}
