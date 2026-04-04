/**
 * GUCCORA MLM Cloud Functions
 *
 * All MLM income logic runs here — never on the client.
 * Triggered by admin clicking Approve in the Admin Panel.
 *
 * approveOrder(orderId):
 *   1. Validates order exists and is still pending
 *   2. Sets isIncomeGiven = true atomically (duplicate prevention)
 *   3. Distributes:
 *      - Direct income ₹40 → sponsor
 *      - Level income ₹5 × 10 levels → parentId chain
 *      - Pair income ₹3 per new matched pair × 10 levels
 *   4. Credits admin wallet
 *   5. Logs every income event in "transactions" collection
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const DIRECT_INCOME = 40;  // ₹40 to sponsor
const LEVEL_INCOME  = 5;   // ₹5 per level (10 levels)
const PAIR_INCOME   = 3;   // ₹3 per new matched pair per level (10 levels)
const MAX_LEVELS    = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch a Firestore user doc. Returns null if not found. */
async function getUser(userId) {
  const snap = await db.collection("users").doc(userId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

/** Queue a transaction log entry into a Firestore batch. */
function batchAddTxn(batch, { userId, type, amount, fromUserId, orderId, level = null }) {
  const ref = db.collection("transactions").doc();
  batch.set(ref, {
    userId,
    type,
    amount,
    fromUserId,
    orderId,
    level,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ── Main Cloud Function ───────────────────────────────────────────────────────

/**
 * approveOrder — HTTPS Callable
 *
 * Called by the admin frontend when approving an order.
 * All income calculation and wallet updates happen here, server-side.
 *
 * @param {object} data.orderId  - Firestore order document ID
 */
exports.approveOrder = onCall(
  { region: "asia-south1" },  // Mumbai — closest to India users
  async (request) => {
    const { orderId } = request.data ?? {};

    if (!orderId || typeof orderId !== "string") {
      throw new HttpsError("invalid-argument", "orderId is required.");
    }

    // ── Step 1: Atomically claim the order ─────────────────────────────────
    // Use a Firestore transaction to check-and-set in one atomic operation.
    // This is the primary duplicate-prevention gate.
    let orderData;
    try {
      await db.runTransaction(async (txn) => {
        const orderRef = db.collection("orders").doc(orderId);
        const orderSnap = await txn.get(orderRef);

        if (!orderSnap.exists) {
          throw new HttpsError("not-found", "Order not found.");
        }

        const data = orderSnap.data();

        if (data.status === "approved") {
          throw new HttpsError("already-exists", "Order already approved.");
        }

        if (data.isIncomeGiven === true) {
          throw new HttpsError("already-exists", "Income already distributed.");
        }

        // Atomically mark as approved + income lock
        txn.update(orderRef, {
          status: "approved",
          isAmountAdded: true,
          isIncomeGiven: true,
          approvedAt: FieldValue.serverTimestamp(),
        });

        orderData = data;
      });
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", "Failed to lock order: " + err.message);
    }

    const buyerUserId = orderData.userId ?? null;
    const orderAmount = orderData.amount ?? 0;

    // ── Step 2: Credit admin wallet ────────────────────────────────────────
    try {
      const adminWalletRef = db.collection("adminWallet").doc("main");
      await adminWalletRef.set(
        { balance: FieldValue.increment(orderAmount) },
        { merge: true }
      );
    } catch (_) {
      // Non-critical — continue with income distribution
    }

    // Save admin wallet transaction
    try {
      await db.collection("transactions").add({
        userId: "admin",
        type: "admin_credit",
        amount: orderAmount,
        fromUserId: buyerUserId ?? "unknown",
        orderId,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (_) {}

    // ── Step 3: MLM income distribution ───────────────────────────────────
    if (!buyerUserId) {
      // No buyer user ID — skip MLM, still return success for order approval
      return { success: true, incomeDistributed: false };
    }

    let buyerData;
    try {
      buyerData = await getUser(buyerUserId);
    } catch (_) {}

    if (!buyerData) {
      return { success: true, incomeDistributed: false };
    }

    // We'll use a single large batch for all income writes.
    // Firestore batch limit is 500 ops; for 10 levels this is well within limits.
    const incomeBatch = db.batch();

    // ── 3a: Direct Income → Sponsor ────────────────────────────────────────
    const sponsorId = buyerData.sponsorId ?? null;
    if (sponsorId) {
      const sponsorRef = db.collection("users").doc(sponsorId);
      incomeBatch.update(sponsorRef, {
        wallet:       FieldValue.increment(DIRECT_INCOME),
        directIncome: FieldValue.increment(DIRECT_INCOME),
      });
      batchAddTxn(incomeBatch, {
        userId:     sponsorId,
        type:       "direct",
        amount:     DIRECT_INCOME,
        fromUserId: buyerUserId,
        orderId,
        level:      0,
      });
    }

    // ── 3b: Level Income → Walk parentId chain (10 levels) ─────────────────
    // Fetch all ancestors first (sequential reads — unavoidable with tree walk).
    const ancestors = [];
    let currentId = buyerData.parentId ?? null;
    let level = 1;

    while (currentId && level <= MAX_LEVELS) {
      try {
        const ancestor = await getUser(currentId);
        if (!ancestor) break;
        ancestors.push({ user: ancestor, level });
        currentId = ancestor.parentId ?? null;
        level++;
      } catch (_) {
        break;
      }
    }

    for (const { user: ancestor, level: lvl } of ancestors) {
      const ancestorRef = db.collection("users").doc(ancestor.id);
      incomeBatch.update(ancestorRef, {
        wallet:      FieldValue.increment(LEVEL_INCOME),
        levelIncome: FieldValue.increment(LEVEL_INCOME),
      });
      batchAddTxn(incomeBatch, {
        userId:     ancestor.id,
        type:       "level",
        amount:     LEVEL_INCOME,
        fromUserId: buyerUserId,
        orderId,
        level:      lvl,
      });
    }

    // ── 3c: Pair Income → Walk parentId chain, track left/right counts ─────
    // We need real-time counts so we must read each ancestor inside a transaction.
    let pairCurrentId = buyerData.parentId ?? null;
    let comingFromSide = buyerData.position ?? null;  // "left" | "right"
    let pairLevel = 1;

    while (pairCurrentId && pairLevel <= MAX_LEVELS && comingFromSide) {
      const ancestorId = pairCurrentId;

      try {
        let pairAmount = 0;
        let ancestorNextParent = null;
        let ancestorNextSide = null;

        await db.runTransaction(async (txn) => {
          const ancestorRef = db.collection("users").doc(ancestorId);
          const ancestorSnap = await txn.get(ancestorRef);
          if (!ancestorSnap.exists) return;

          const data = ancestorSnap.data();
          const oldLeft  = (data.leftCount  ?? 0);
          const oldRight = (data.rightCount ?? 0);
          const oldPairs = Math.min(oldLeft, oldRight);

          const countField = comingFromSide === "left" ? "leftCount" : "rightCount";
          const newLeft  = comingFromSide === "left"  ? oldLeft  + 1 : oldLeft;
          const newRight = comingFromSide === "right" ? oldRight + 1 : oldRight;
          const newPairs = Math.min(newLeft, newRight);
          const additionalPairs = newPairs - oldPairs;

          const updates = { [countField]: FieldValue.increment(1) };

          if (additionalPairs > 0) {
            pairAmount = additionalPairs * PAIR_INCOME;
            updates.wallet     = FieldValue.increment(pairAmount);
            updates.pairIncome = FieldValue.increment(pairAmount);
          }

          txn.update(ancestorRef, updates);

          // Capture parent info for next iteration (inside txn for fresh read)
          ancestorNextParent = data.parentId ?? null;
          ancestorNextSide   = data.position ?? null;
        });

        // Log pair transaction if income was given
        if (pairAmount > 0) {
          await db.collection("transactions").add({
            userId:     ancestorId,
            type:       "pair",
            amount:     pairAmount,
            fromUserId: buyerUserId,
            orderId,
            level:      pairLevel,
            createdAt:  FieldValue.serverTimestamp(),
          });
        }

        pairCurrentId  = ancestorNextParent;
        comingFromSide = ancestorNextSide;
      } catch (_) {
        break;
      }

      pairLevel++;
    }

    // ── Step 4: Commit all direct + level income writes ────────────────────
    try {
      await incomeBatch.commit();
    } catch (err) {
      throw new HttpsError("internal", "Failed to commit income batch: " + err.message);
    }

    return { success: true, incomeDistributed: true };
  }
);
