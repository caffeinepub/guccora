/**
 * GuccoraContext.tsx — v2 FORCED REBUILD
 *
 * State management: auth, wallet sync, user data, real-time Firestore listener.
 * Admin phone: 6305462887, password: guccora@4348.
 *
 * CRITICAL: purchasing user wallet NEVER incremented on plan purchase.
 * Only commissions go to sponsor/upline via MLM approval logic.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { db, isFirebaseConfigured } from "../firebase";
import type { FirestoreUser, UserStatus } from "../utils/mlmTree";

export type Plan = {
  id: string;
  name: string;
  price: number;
  directIncome: number;
  levelIncome: number;
  pairIncome: number;
  levels: number;
  durationDays: number;
};

export type Transaction = {
  id: string;
  type: "income" | "withdrawal" | "adjustment" | "debit";
  amount: number;
  description: string;
  timestamp: number;
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  isRead: boolean;
};

export type KycStatus = "none" | "pending" | "approved" | "rejected";
export type PlanStatus = "none" | "active" | "expired" | "pending";

export type WithdrawalRequest = {
  id: string;
  amount: number;
  upiId: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  status: "pending" | "approved" | "rejected";
  timestamp: number;
};

export type PaymentRequest = {
  id: string;
  planId: string;
  upiRef: string;
  screenshotUrl: string;
  status: "pending" | "approved" | "rejected";
  timestamp: number;
};

export type TeamMember = {
  principal: string;
  name: string;
  phone: string;
  level: number;
  planId: string | null;
  isActive: boolean;
  userStatus: UserStatus;
  referralCode: string;
  joinedAt: number;
};

export type Order = {
  id: string;
  productId: string;
  productName: string;
  amount: number;
  planType: string;
  address: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  status: "pending" | "processing" | "shipped" | "delivered";
  timestamp: number;
};

export type SavedAddress = {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
};

export type UserData = {
  name: string;
  phone: string;
  email?: string;
  referralCode: string;
  uplineCode?: string;
  planId: string | null;
  planExpiry: number | null;
  planStatus: PlanStatus;
  isActive: boolean;
  userStatus: UserStatus;
  walletBalance: number;
  directIncome: number;
  levelIncome: number;
  pairIncome: number;
  kycStatus: KycStatus;
  kycRejectionReason?: string;
  kycAadharFront?: string;
  kycAadharBack?: string;
  kycPan?: string;
  transactions: Transaction[];
  withdrawals: WithdrawalRequest[];
  paymentRequests: PaymentRequest[];
  team: TeamMember[];
  orders: Order[];
  notifications: Notification[];
  bankDetails?: {
    upiId?: string;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
  };
  savedAddress?: SavedAddress;
  paidUser?: boolean;
  selectedPlan?: 599 | 999 | 1999 | 2999 | null;
};

export type CurrentUser = {
  id?: string;
  name: string;
  phone: string;
  password: string;
  referralCode: string;
  role: "admin" | "user";
};

export const PLANS: Plan[] = [
  {
    id: "599",
    name: "Starter",
    price: 599,
    directIncome: 40,
    levelIncome: 5,
    pairIncome: 30,
    levels: 10,
    durationDays: 30,
  },
  {
    id: "999",
    name: "Silver",
    price: 999,
    directIncome: 70,
    levelIncome: 8,
    pairIncome: 50,
    levels: 10,
    durationDays: 30,
  },
  {
    id: "1999",
    name: "Gold",
    price: 1999,
    directIncome: 140,
    levelIncome: 16,
    pairIncome: 100,
    levels: 10,
    durationDays: 30,
  },
  {
    id: "2999",
    name: "Platinum",
    price: 2999,
    directIncome: 210,
    levelIncome: 24,
    pairIncome: 150,
    levels: 10,
    durationDays: 30,
  },
];

const STORAGE_KEY = "guccora_v1";
const WALLETS_KEY = "guccora_wallets";
const CURRENT_USER_KEY = "guccora_currentUser";
const USERS_KEY = "users";
const ADMIN_WALLET_KEY = "guccora_admin_wallet";

const ADMIN_PHONE = "6305462887";
const ADMIN_PASSWORD = "guccora@4348";

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

function saveUserToUsersArray(
  userId: string,
  updates: Record<string, unknown>,
) {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const users: FirestoreUser[] = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates } as FirestoreUser;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  } catch {
    // ignore
  }
}

function createEmptyData(): UserData {
  return {
    name: "",
    phone: "",
    referralCode: generateCode(),
    uplineCode: undefined,
    planId: null,
    planExpiry: null,
    planStatus: "none",
    isActive: false,
    userStatus: "inactive",
    walletBalance: 0,
    directIncome: 0,
    levelIncome: 0,
    pairIncome: 0,
    kycStatus: "none",
    transactions: [],
    withdrawals: [],
    paymentRequests: [],
    team: [],
    orders: [],
    notifications: [],
    paidUser: false,
    selectedPlan: null,
  };
}

type GuccoraContextType = {
  userData: UserData;
  currentUser: CurrentUser | null;
  isProfileComplete: boolean;
  isAdmin: boolean;
  updateProfile: (name: string, phone: string, referralCode?: string) => void;
  login: (
    phone: string,
    password: string,
  ) => { success: boolean; error?: string; role?: "admin" | "user" };
  logout: () => void;
  register: (
    name: string,
    phone: string,
    password: string,
    referralCode?: string,
    position?: "left" | "right",
  ) => Promise<{ success: boolean; error?: string }>;
  submitPaymentRequest: (
    planId: string,
    upiRef: string,
    screenshotUrl: string,
  ) => void;
  submitWithdrawal: (
    amount: number,
    upiId: string,
    bankDetails?: { bankName?: string; accountNumber?: string; ifsc?: string },
  ) => { success: boolean; error?: string };
  submitKyc: (aadharFront: string, aadharBack: string, pan: string) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  addOrder: (data: {
    productId: string;
    productName: string;
    amount: number;
    planType: string;
    address: Order["address"];
  }) => void;
  updateBankDetails: (details: UserData["bankDetails"]) => void;
  saveDeliveryAddress: (address: SavedAddress) => void;
  markUserPaid: (planAmount: 599 | 999 | 1999 | 2999) => Promise<void>;
  adminApprovePayment: (requestId: string) => void;
  adminRejectPayment: (requestId: string) => void;
  adminApproveKyc: () => void;
  adminRejectKyc: (reason: string) => void;
  adminApproveWithdrawal: (id: string) => void;
  adminRejectWithdrawal: (id: string) => void;
  adminAdjustWallet: (amount: number, description: string) => void;
  adminAdjustUserWallet: (
    userId: string,
    amount: number,
    description: string,
  ) => void;
  getWalletMap: () => Record<string, number>;
  adminSendNotification: (title: string, message: string) => void;
  adminSetUserStatus: (userId: string, status: UserStatus) => void;
};

const GuccoraContext = createContext<GuccoraContextType | null>(null);

export function GuccoraProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    // One-time cleanup of stale demo data
    const CLEANUP_FLAG = "guccora_cleaned_v2";
    if (!localStorage.getItem(CLEANUP_FLAG)) {
      localStorage.removeItem("orders");
      localStorage.removeItem("guccora_transactions");
      localStorage.removeItem(WALLETS_KEY);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.setItem(
        ADMIN_WALLET_KEY,
        JSON.stringify({ balance: 0, history: [] }),
      );
      localStorage.setItem(CLEANUP_FLAG, "true");
      return null;
    }
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) return JSON.parse(stored) as CurrentUser;
    } catch {
      // ignore
    }
    return null;
  });

  const currentUserRef = useRef<CurrentUser | null>(null);
  currentUserRef.current = currentUser;

  const [userData, setUserData] = useState<UserData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserData;
        parsed.team = (parsed.team || []).filter(
          (m) => !m.principal.startsWith("user-"),
        );
        if (!parsed.userStatus) {
          parsed.userStatus = parsed.isActive ? "active" : "inactive";
        }
        if (parsed.paidUser === undefined) parsed.paidUser = false;
        return parsed;
      }
    } catch {
      // ignore
    }
    return createEmptyData();
  });

  // Sync userData name/phone from currentUser
  useEffect(() => {
    if (currentUser && (!userData.name || !userData.phone)) {
      setUserData((prev) => ({
        ...prev,
        name: currentUser.name || prev.name,
        phone: currentUser.phone || prev.phone,
      }));
    }
  }, [currentUser, userData.name, userData.phone]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    } catch {
      // ignore
    }
  }, [userData]);

  // Sync wallet + status back to "users" array
  useEffect(() => {
    if (!currentUser?.id) return;
    saveUserToUsersArray(currentUser.id, {
      wallet: userData.walletBalance,
      isActive: userData.isActive,
      userStatus: userData.userStatus,
      planStatus: userData.planStatus,
      directIncome: userData.directIncome,
      levelIncome: userData.levelIncome,
      pairIncome: userData.pairIncome,
      paidUser: userData.paidUser,
      selectedPlan: userData.selectedPlan ?? undefined,
      planActive: userData.paidUser === true,
    });
  }, [
    currentUser?.id,
    userData.walletBalance,
    userData.isActive,
    userData.userStatus,
    userData.planStatus,
    userData.directIncome,
    userData.levelIncome,
    userData.pairIncome,
    userData.paidUser,
    userData.selectedPlan,
  ]);

  // ── Real-time Firestore listener — keeps wallet/income/isActive in sync ──
  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId || !isFirebaseConfigured) return;

    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data() as Record<string, unknown>;
        setUserData((prev) => ({
          ...prev,
          walletBalance:
            typeof d.wallet === "number" ? d.wallet : prev.walletBalance,
          directIncome:
            typeof d.directIncome === "number"
              ? d.directIncome
              : prev.directIncome,
          levelIncome:
            typeof d.levelIncome === "number"
              ? d.levelIncome
              : prev.levelIncome,
          pairIncome:
            typeof d.pairIncome === "number" ? d.pairIncome : prev.pairIncome,
          isActive:
            typeof d.isActive === "boolean" ? d.isActive : prev.isActive,
          paidUser:
            typeof d.paidUser === "boolean" ? d.paidUser : prev.paidUser,
          userStatus: (d.userStatus as UserStatus) ?? prev.userStatus,
          planStatus:
            typeof d.isActive === "boolean" && d.isActive
              ? "active"
              : ((d.planStatus as PlanStatus) ?? prev.planStatus),
          selectedPlan:
            typeof d.selectedPlan === "number"
              ? (d.selectedPlan as 599 | 999 | 1999 | 2999)
              : prev.selectedPlan,
          planId:
            typeof d.planId === "string" ? (d.planId as string) : prev.planId,
        }));
      },
      () => {
        // Firestore listener error — keep localStorage values
      },
    );
    return () => unsub();
  }, [currentUser?.id]);

  const isProfileComplete = !!currentUser;
  const isAdmin = currentUser?.phone === ADMIN_PHONE;

  const login = useCallback(
    (
      phone: string,
      password: string,
    ): { success: boolean; error?: string; role?: "admin" | "user" } => {
      const cleanPhone = phone.trim();
      const cleanPass = password.trim();

      if (cleanPhone === ADMIN_PHONE && cleanPass === ADMIN_PASSWORD) {
        const adminUser: CurrentUser = {
          name: "Admin",
          phone: ADMIN_PHONE,
          password: ADMIN_PASSWORD,
          referralCode: "ADMIN0",
          role: "admin",
        };
        setCurrentUser(adminUser);
        try {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminUser));
        } catch {
          // ignore
        }
        setUserData((prev) => ({ ...prev, name: "Admin", phone: ADMIN_PHONE }));
        return { success: true, role: "admin" };
      }

      try {
        const stored = localStorage.getItem(USERS_KEY);
        const users: FirestoreUser[] = stored ? JSON.parse(stored) : [];
        const found = users.find(
          (u) => u.phone === cleanPhone && u.password === cleanPass,
        );
        if (found) {
          const foundAsCurrentUser: CurrentUser = {
            id: found.id,
            name: found.name,
            phone: found.phone,
            password: found.password,
            referralCode: found.referralCode,
            role:
              (found as FirestoreUser & { role?: "admin" | "user" }).role ??
              "user",
          };
          setCurrentUser(foundAsCurrentUser);
          localStorage.setItem(
            CURRENT_USER_KEY,
            JSON.stringify(foundAsCurrentUser),
          );

          const savedUserStatus: UserStatus =
            found.userStatus ?? (found.isActive ? "active" : "inactive");

          setUserData((prev) => ({
            ...prev,
            name: found.name,
            phone: found.phone,
            referralCode: found.referralCode || prev.referralCode,
            walletBalance:
              typeof found.wallet === "number"
                ? found.wallet
                : prev.walletBalance,
            isActive: savedUserStatus === "active",
            userStatus: savedUserStatus,
            planStatus:
              savedUserStatus === "active" ? "active" : prev.planStatus,
            directIncome:
              typeof found.directIncome === "number"
                ? found.directIncome
                : prev.directIncome,
            levelIncome:
              typeof found.levelIncome === "number"
                ? found.levelIncome
                : prev.levelIncome,
            pairIncome:
              typeof found.pairIncome === "number"
                ? found.pairIncome
                : prev.pairIncome,
            paidUser: found.paidUser === true,
            selectedPlan:
              (
                found as FirestoreUser & {
                  selectedPlan?: number;
                  plan?: string | number;
                }
              ).selectedPlan ||
              (found as FirestoreUser & { plan?: string | number }).plan
                ? (Number(
                    (
                      found as FirestoreUser & {
                        selectedPlan?: number;
                        plan?: string | number;
                      }
                    ).selectedPlan ??
                      (found as FirestoreUser & { plan?: string | number })
                        .plan,
                  ) as 599 | 999 | 1999 | 2999)
                : null,
          }));

          // Silently pull latest values from Firestore after login
          if (isFirebaseConfigured && found.id) {
            getDoc(doc(db, "users", found.id))
              .then((snap) => {
                if (!snap.exists()) return;
                const d = snap.data() as Record<string, unknown>;
                setUserData((prev) => ({
                  ...prev,
                  walletBalance:
                    typeof d.wallet === "number"
                      ? d.wallet
                      : prev.walletBalance,
                  directIncome:
                    typeof d.directIncome === "number"
                      ? d.directIncome
                      : prev.directIncome,
                  levelIncome:
                    typeof d.levelIncome === "number"
                      ? d.levelIncome
                      : prev.levelIncome,
                  pairIncome:
                    typeof d.pairIncome === "number"
                      ? d.pairIncome
                      : prev.pairIncome,
                  isActive:
                    typeof d.isActive === "boolean"
                      ? d.isActive
                      : prev.isActive,
                  userStatus: (d.userStatus as UserStatus) ?? prev.userStatus,
                  planStatus: (d.planStatus as PlanStatus) ?? prev.planStatus,
                  paidUser:
                    typeof d.paidUser === "boolean"
                      ? d.paidUser
                      : prev.paidUser,
                }));
                saveUserToUsersArray(found.id, {
                  wallet: d.wallet ?? found.wallet,
                  directIncome: d.directIncome ?? found.directIncome,
                  levelIncome: d.levelIncome ?? found.levelIncome,
                  pairIncome: d.pairIncome ?? found.pairIncome,
                  isActive: d.isActive ?? found.isActive,
                  userStatus: d.userStatus ?? found.userStatus,
                  planStatus:
                    d.planStatus ??
                    (found as FirestoreUser & { planStatus?: string })
                      .planStatus,
                  paidUser: d.paidUser ?? found.paidUser,
                });
              })
              .catch(() => {
                // Firestore unreachable — localStorage values used
              });
          }

          return {
            success: true,
            role:
              (found as FirestoreUser & { role?: "admin" | "user" }).role ??
              "user",
          };
        }
      } catch {
        // ignore
      }

      return { success: false, error: "Invalid phone number or password" };
    },
    [],
  );

  const logout = useCallback(() => {
    if (currentUser?.id) {
      saveUserToUsersArray(currentUser.id, {
        wallet: userData.walletBalance,
        isActive: userData.isActive,
        userStatus: userData.userStatus,
        planStatus: userData.planStatus,
        directIncome: userData.directIncome,
        levelIncome: userData.levelIncome,
        pairIncome: userData.pairIncome,
        paidUser: userData.paidUser,
      });
    }
    setCurrentUser(null);
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch {
      // ignore
    }
    setUserData(createEmptyData());
  }, [currentUser, userData]);

  const register = useCallback(
    async (
      name: string,
      phone: string,
      password: string,
      referralCode?: string,
      position?: "left" | "right",
    ): Promise<{ success: boolean; error?: string }> => {
      const cleanPhone = phone.trim();
      const cleanName = name.trim();
      const cleanPass = password.trim();

      if (!cleanName || !cleanPhone || !cleanPass) {
        return { success: false, error: "All fields are required" };
      }
      if (cleanPhone.length !== 10) {
        return { success: false, error: "Phone must be 10 digits" };
      }

      const stored = localStorage.getItem(USERS_KEY);
      const existingUsers: FirestoreUser[] = stored ? JSON.parse(stored) : [];
      const existing = existingUsers.find((u) => u.phone === cleanPhone);
      if (existing) {
        return {
          success: false,
          error: "Phone number already registered. Please login.",
        };
      }

      const newId =
        Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newReferralCode = generateCode();
      const sponsorCode = referralCode?.trim() || null;
      let sponsorId: string | null = sponsorCode;

      if (sponsorCode) {
        const sponsor = existingUsers.find(
          (u) => u.referralCode === sponsorCode,
        );
        if (sponsor) sponsorId = sponsor.id;
      }

      const newUserObj: FirestoreUser = {
        id: newId,
        name: cleanName,
        phone: cleanPhone,
        password: cleanPass,
        sponsorId,
        referredBy: sponsorCode,
        position: position ?? "left",
        parentId: null,
        leftChild: null,
        rightChild: null,
        wallet: 0,
        directIncome: 0,
        levelIncome: 0,
        pairIncome: 0,
        leftCount: 0,
        rightCount: 0,
        referralCode: newReferralCode,
        isActive: false,
        userStatus: "inactive",
        paidUser: false,
        createdAt: Date.now(),
      };

      if (!existingUsers.find((u) => u.id === newId)) {
        existingUsers.push(newUserObj);

        if (sponsorId) {
          const sponsorIdx = existingUsers.findIndex(
            (u) => u.id === sponsorId || u.referralCode === sponsorCode,
          );
          if (sponsorIdx !== -1) {
            const sponsor = existingUsers[sponsorIdx];
            const pos = position ?? "left";
            if (pos === "left" && !sponsor.leftChild) {
              existingUsers[sponsorIdx] = { ...sponsor, leftChild: newId };
            } else if (pos === "right" && !sponsor.rightChild) {
              existingUsers[sponsorIdx] = { ...sponsor, rightChild: newId };
            }
            const newIdx = existingUsers.findIndex((u) => u.id === newId);
            if (newIdx !== -1) {
              existingUsers[newIdx] = {
                ...existingUsers[newIdx],
                parentId: existingUsers[sponsorIdx].id,
              };
            }
          }
        }

        try {
          localStorage.setItem(USERS_KEY, JSON.stringify(existingUsers));
        } catch {
          // ignore
        }
      }

      // Write to Firestore with 5s timeout
      if (isFirebaseConfigured) {
        try {
          await Promise.race([
            setDoc(doc(db, "users", newId), newUserObj),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 5000),
            ),
          ]);
        } catch {
          // Offline or timed out — localStorage save is sufficient
        }
      }

      const newCurrentUser: CurrentUser = {
        id: newId,
        name: cleanName,
        phone: cleanPhone,
        password: cleanPass,
        referralCode: newReferralCode,
        role: "user",
      };
      setCurrentUser(newCurrentUser);
      try {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newCurrentUser));
      } catch {
        // ignore
      }

      const userDataWithProfile: UserData = {
        ...createEmptyData(),
        name: cleanName,
        phone: cleanPhone,
        referralCode: newReferralCode,
        uplineCode: referralCode?.trim() || undefined,
        isActive: false,
        userStatus: "inactive",
        paidUser: false,
        notifications: [
          {
            id: generateId(),
            title: "Welcome to GUCCORA!",
            message:
              "Your account has been created. Purchase a plan to get activated by admin!",
            timestamp: Date.now(),
            isRead: false,
          },
        ],
      };
      setUserData(userDataWithProfile);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userDataWithProfile));
      } catch {
        // ignore
      }

      return { success: true };
    },
    [],
  );

  const updateProfile = useCallback(
    (name: string, phone: string, referralCode?: string) => {
      setUserData((prev) => ({
        ...prev,
        name,
        phone,
        uplineCode: referralCode || prev.uplineCode,
      }));
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, name, phone };
        try {
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    },
    [],
  );

  /**
   * submitPaymentRequest — saves to Firestore "payments" collection AND updates local UI state.
   * This is called by PlansPage after savePaymentToFirestore() succeeds.
   * Only updates local state (pending status in UI) — Firestore write is handled by PlansPage.
   */
  const submitPaymentRequest = useCallback(
    (planId: string, upiRef: string, screenshotUrl: string) => {
      const req: PaymentRequest = {
        id: generateId(),
        planId,
        upiRef,
        screenshotUrl,
        status: "pending",
        timestamp: Date.now(),
      };
      setUserData((prev) => ({
        ...prev,
        paymentRequests: [req, ...prev.paymentRequests],
        planStatus: "pending",
        notifications: [
          {
            id: generateId(),
            title: "Payment Submitted",
            message:
              "Your payment is under review. Admin will approve shortly.",
            timestamp: Date.now(),
            isRead: false,
          },
          ...prev.notifications,
        ],
      }));
    },
    [],
  );

  const submitWithdrawal = useCallback(
    (
      amount: number,
      upiId: string,
      bankDetails?: {
        bankName?: string;
        accountNumber?: string;
        ifsc?: string;
      },
    ): { success: boolean; error?: string } => {
      if (userData.kycStatus !== "approved") {
        return { success: false, error: "KYC verification required" };
      }
      if (amount > userData.walletBalance) {
        return { success: false, error: "Insufficient balance" };
      }
      const request: WithdrawalRequest = {
        id: generateId(),
        amount,
        upiId,
        bankName: bankDetails?.bankName,
        accountNumber: bankDetails?.accountNumber,
        ifsc: bankDetails?.ifsc,
        status: "pending",
        timestamp: Date.now(),
      };
      setUserData((prev) => ({
        ...prev,
        walletBalance: prev.walletBalance - amount,
        withdrawals: [request, ...prev.withdrawals],
        transactions: [
          {
            id: generateId(),
            type: "debit",
            amount,
            description: `Withdrawal request submitted (UPI: ${upiId})`,
            timestamp: Date.now(),
          },
          ...prev.transactions,
        ],
      }));
      return { success: true };
    },
    [userData.kycStatus, userData.walletBalance],
  );

  const submitKyc = useCallback(
    (aadharFront: string, aadharBack: string, pan: string) => {
      setUserData((prev) => ({
        ...prev,
        kycStatus: "pending",
        kycAadharFront: aadharFront,
        kycAadharBack: aadharBack,
        kycPan: pan,
        kycRejectionReason: undefined,
        notifications: [
          {
            id: generateId(),
            title: "KYC Submitted",
            message:
              "Your KYC documents have been submitted. Admin will verify shortly.",
            timestamp: Date.now(),
            isRead: false,
          },
          ...prev.notifications,
        ],
      }));
    },
    [],
  );

  const markNotificationRead = useCallback((id: string) => {
    setUserData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    }));
  }, []);

  const markAllRead = useCallback(() => {
    setUserData((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
    }));
  }, []);

  const addOrder = useCallback(
    (data: {
      productId: string;
      productName: string;
      amount: number;
      planType: string;
      address: Order["address"];
    }) => {
      const order: Order = {
        id: generateId(),
        productId: data.productId,
        productName: data.productName,
        amount: data.amount,
        planType: data.planType,
        address: data.address,
        status: "pending",
        timestamp: Date.now(),
      };
      setUserData((prev) => ({
        ...prev,
        orders: [order, ...prev.orders],
        notifications: [
          {
            id: generateId(),
            title: "Order Placed!",
            message: `Your ${data.planType} plan order has been placed. Waiting for admin approval.`,
            timestamp: Date.now(),
            isRead: false,
          },
          ...prev.notifications,
        ],
      }));
    },
    [],
  );

  const updateBankDetails = useCallback((details: UserData["bankDetails"]) => {
    setUserData((prev) => ({ ...prev, bankDetails: details }));
  }, []);

  const saveDeliveryAddress = useCallback((address: SavedAddress) => {
    setUserData((prev) => ({ ...prev, savedAddress: address }));
  }, []);

  /**
   * markUserPaid — marks paidUser=true + selectedPlan in Firestore.
   * Used only by confirm-payment flow. Does NOT credit wallet to the purchasing user.
   */
  const markUserPaid = useCallback(
    async (planAmount: 599 | 999 | 1999 | 2999) => {
      if (!currentUser?.id) return;

      const userRef = doc(db, "users", currentUser.id);
      try {
        const userSnap = await getDoc(userRef);
        if (
          userSnap.exists() &&
          (userSnap.data() as Record<string, unknown>)?.paidUser === true
        ) {
          // Already paid — just sync local state
          const existingPlan = (userSnap.data() as Record<string, unknown>)
            ?.selectedPlan as number | undefined;
          setUserData((prev) => ({
            ...prev,
            paidUser: true,
            selectedPlan:
              (existingPlan as 599 | 999 | 1999 | 2999 | null) ?? planAmount,
          }));
          return;
        }

        await setDoc(
          userRef,
          { paidUser: true, selectedPlan: planAmount },
          { merge: true },
        );
      } catch {
        // Firestore unreachable — update locally only
      }

      setUserData((prev) => ({
        ...prev,
        paidUser: true,
        selectedPlan: planAmount,
      }));
      if (currentUser.id) {
        saveUserToUsersArray(currentUser.id, {
          paidUser: true,
          selectedPlan: planAmount,
        });
      }
    },
    [currentUser],
  );

  // Admin actions
  const adminApprovePayment = useCallback(
    (requestId: string) => {
      if (currentUser?.id) {
        saveUserToUsersArray(currentUser.id, {
          isActive: true,
          userStatus: "active",
          planStatus: "active",
        });
      }
      setUserData((prev) => {
        const req = prev.paymentRequests.find((r) => r.id === requestId);
        if (!req) return prev;
        const plan = PLANS.find((p) => p.id === req.planId);
        const now = Date.now();
        return {
          ...prev,
          planId: req.planId,
          planExpiry: now + 30 * 86400000,
          planStatus: "active",
          isActive: true,
          userStatus: "active" as UserStatus,
          walletBalance: prev.walletBalance + (plan?.directIncome ?? 0),
          directIncome: prev.directIncome + (plan?.directIncome ?? 0),
          paymentRequests: prev.paymentRequests.map((r) =>
            r.id === requestId ? { ...r, status: "approved" } : r,
          ),
          transactions: [
            {
              id: generateId(),
              type: "income" as const,
              amount: plan?.directIncome ?? 0,
              description: `Plan ${req.planId} activated — direct income credited`,
              timestamp: now,
            },
            ...prev.transactions,
          ],
          notifications: [
            {
              id: generateId(),
              title: "Plan Activated!",
              message: `Your ₹${req.planId} plan has been approved and activated.`,
              timestamp: now,
              isRead: false,
            },
            ...prev.notifications,
          ],
        };
      });
      if (isFirebaseConfigured) {
        setDoc(
          doc(db, "paymentRequests", requestId),
          { status: "approved" },
          { merge: true },
        ).catch(() => {
          // ignore
        });
      }
    },
    [currentUser?.id],
  );

  const adminRejectPayment = useCallback((requestId: string) => {
    setUserData((prev) => ({
      ...prev,
      planStatus: "none",
      paymentRequests: prev.paymentRequests.map((r) =>
        r.id === requestId ? { ...r, status: "rejected" } : r,
      ),
      notifications: [
        {
          id: generateId(),
          title: "Payment Rejected",
          message:
            "Your payment request has been rejected. Please contact support.",
          timestamp: Date.now(),
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
  }, []);

  const adminApproveKyc = useCallback(() => {
    setUserData((prev) => ({
      ...prev,
      kycStatus: "approved",
      kycRejectionReason: undefined,
      notifications: [
        {
          id: generateId(),
          title: "KYC Approved!",
          message:
            "Your KYC verification has been approved. You can now withdraw funds.",
          timestamp: Date.now(),
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
  }, []);

  const adminRejectKyc = useCallback((reason: string) => {
    setUserData((prev) => ({
      ...prev,
      kycStatus: "rejected",
      kycRejectionReason: reason,
      notifications: [
        {
          id: generateId(),
          title: "KYC Rejected",
          message: `Your KYC was rejected. Reason: ${reason}. Please resubmit.`,
          timestamp: Date.now(),
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
  }, []);

  const adminApproveWithdrawal = useCallback((id: string) => {
    setUserData((prev) => ({
      ...prev,
      withdrawals: prev.withdrawals.map((w) =>
        w.id === id ? { ...w, status: "approved" } : w,
      ),
      notifications: [
        {
          id: generateId(),
          title: "Withdrawal Approved",
          message: "Your withdrawal request has been approved and processed.",
          timestamp: Date.now(),
          isRead: false,
        },
        ...prev.notifications,
      ],
    }));
  }, []);

  const adminRejectWithdrawal = useCallback((id: string) => {
    setUserData((prev) => {
      const withdrawal = prev.withdrawals.find((w) => w.id === id);
      return {
        ...prev,
        walletBalance: prev.walletBalance + (withdrawal?.amount ?? 0),
        withdrawals: prev.withdrawals.map((w) =>
          w.id === id ? { ...w, status: "rejected" } : w,
        ),
        transactions: [
          {
            id: generateId(),
            type: "adjustment" as const,
            amount: withdrawal?.amount ?? 0,
            description: "Withdrawal rejected — amount refunded",
            timestamp: Date.now(),
          },
          ...prev.transactions,
        ],
      };
    });
  }, []);

  const adminAdjustWallet = useCallback(
    (amount: number, description: string) => {
      setUserData((prev) => ({
        ...prev,
        walletBalance: prev.walletBalance + amount,
        transactions: [
          {
            id: generateId(),
            type: amount >= 0 ? ("adjustment" as const) : ("debit" as const),
            amount: Math.abs(amount),
            description,
            timestamp: Date.now(),
          },
          ...prev.transactions,
        ],
      }));
    },
    [],
  );

  const adminAdjustUserWallet = useCallback(
    (userId: string, amount: number, description: string) => {
      try {
        const stored = localStorage.getItem(WALLETS_KEY);
        const wallets: Record<string, number> = stored
          ? JSON.parse(stored)
          : {};
        wallets[userId] = (wallets[userId] ?? 0) + amount;
        localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
      } catch {
        // ignore
      }
      if (userId === "current") {
        adminAdjustWallet(amount, description);
      }
    },
    [adminAdjustWallet],
  );

  const getWalletMap = useCallback((): Record<string, number> => {
    try {
      const stored = localStorage.getItem(WALLETS_KEY);
      if (stored) return JSON.parse(stored) as Record<string, number>;
    } catch {
      // ignore
    }
    return {};
  }, []);

  const adminSendNotification = useCallback(
    (title: string, message: string) => {
      setUserData((prev) => ({
        ...prev,
        notifications: [
          {
            id: generateId(),
            title,
            message,
            timestamp: Date.now(),
            isRead: false,
          },
          ...prev.notifications,
        ],
      }));
    },
    [],
  );

  const adminSetUserStatus = useCallback(
    async (userId: string, status: UserStatus) => {
      try {
        const raw = localStorage.getItem(USERS_KEY);
        const users: FirestoreUser[] = raw ? JSON.parse(raw) : [];
        const idx = users.findIndex((u) => u.id === userId);
        if (idx !== -1) {
          users[idx] = {
            ...users[idx],
            userStatus: status,
            isActive: status === "active",
          };
          localStorage.setItem(USERS_KEY, JSON.stringify(users));
        }
      } catch {
        // ignore
      }

      if (currentUser?.id === userId) {
        setUserData((prev) => ({
          ...prev,
          userStatus: status,
          isActive: status === "active",
        }));
      }

      if (isFirebaseConfigured) {
        try {
          await Promise.race([
            updateDoc(doc(db, "users", userId), {
              userStatus: status,
              isActive: status === "active",
            }),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 5000),
            ),
          ]);
        } catch {
          // ignore
        }
      }
    },
    [currentUser?.id],
  );

  // ── Save payment to Firestore when user submits ───────────────────────────
  const savePaymentToFirestoreContext = useCallback(
    async (params: {
      planId: string;
      upiRef: string;
      screenshotBase64: string;
      planAmount: number;
    }) => {
      if (!currentUser) return;
      try {
        await addDoc(collection(db, "payments"), {
          userId: currentUser.id || currentUser.phone || "",
          name: currentUser.name ?? "",
          phone: currentUser.phone ?? "",
          planAmount: params.planAmount,
          UTR: params.upiRef,
          screenshot: params.screenshotBase64,
          status: "pending",
          createdAt: Date.now(),
        });
      } catch {
        // ignore — PlansPage handles this directly via savePaymentToFirestore()
      }
    },
    [currentUser],
  );

  // Expose savePaymentToFirestoreContext on context for optional use
  void savePaymentToFirestoreContext;

  return (
    <GuccoraContext.Provider
      value={{
        userData,
        currentUser,
        isProfileComplete,
        isAdmin,
        updateProfile,
        login,
        logout,
        register,
        submitPaymentRequest,
        submitWithdrawal,
        submitKyc,
        markNotificationRead,
        markAllRead,
        addOrder,
        updateBankDetails,
        saveDeliveryAddress,
        markUserPaid,
        adminApprovePayment,
        adminRejectPayment,
        adminApproveKyc,
        adminRejectKyc,
        adminApproveWithdrawal,
        adminRejectWithdrawal,
        adminAdjustWallet,
        adminAdjustUserWallet,
        getWalletMap,
        adminSendNotification,
        adminSetUserStatus,
      }}
    >
      {children}
    </GuccoraContext.Provider>
  );
}

export function useGuccora(): GuccoraContextType {
  const ctx = useContext(GuccoraContext);
  if (!ctx) throw new Error("useGuccora must be used within GuccoraProvider");
  return ctx;
}
