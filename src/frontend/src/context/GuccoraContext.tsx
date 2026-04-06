import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
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
// IMPORTANT: Use canonical "users" key — consistent across all pages
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
    const raw = localStorage.getItem("users");
    const users: FirestoreUser[] = raw ? JSON.parse(raw) : [];
    const idx = users.findIndex((u) => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      localStorage.setItem("users", JSON.stringify(users));
    }
  } catch (e) {
    console.error("saveUserToUsersArray error", e);
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
  // Admin actions
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
  // Load currentUser from localStorage on init
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    // Run demo-data cleanup synchronously before reading any localStorage state
    const CLEANUP_FLAG = "guccora_cleaned_v2";
    if (!localStorage.getItem(CLEANUP_FLAG)) {
      localStorage.removeItem("orders");
      localStorage.removeItem("guccora_transactions");
      localStorage.removeItem(WALLETS_KEY);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CURRENT_USER_KEY);
      // NOTE: Do NOT remove USERS_KEY ("users") — we want registered users to persist
      localStorage.setItem(
        ADMIN_WALLET_KEY,
        JSON.stringify({ balance: 0, history: [] }),
      );
      localStorage.setItem(CLEANUP_FLAG, "true");
      return null; // force re-login after cleanup
    }
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) return JSON.parse(stored) as CurrentUser;
    } catch {
      // ignore
    }
    return null;
  });

  // Ref to always have latest currentUser in useCallback closures
  const currentUserRef = useRef<CurrentUser | null>(null);
  currentUserRef.current = currentUser;

  const [userData, setUserData] = useState<UserData>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserData;
        // Clear any demo team members (those with principal starting with "user-")
        parsed.team = (parsed.team || []).filter(
          (m) => !m.principal.startsWith("user-"),
        );
        // Ensure userStatus is set (backward compat with old data)
        if (!parsed.userStatus) {
          parsed.userStatus = parsed.isActive ? "active" : "inactive";
        }
        // Ensure paidUser is set (backward compat)
        if (parsed.paidUser === undefined) {
          parsed.paidUser = false;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return createEmptyData();
  });

  // Sync userData name/phone from currentUser when currentUser changes
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

  // Sync wallet + status back to "users" array whenever they change
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

  // ── Real-time Firestore listener for current user ─────────────────────
  // Keeps wallet, income, isActive, paidUser in sync with Firestore after admin approval
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
            typeof d.planId === "string"
              ? (d.planId as "599" | "999" | "1999" | "2999")
              : prev.planId,
        }));
      },
      () => {
        // Firestore listener error — ignore, keep localStorage values
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // isProfileComplete: user is logged in
  const isProfileComplete = !!currentUser;

  // Admin is determined by phone number
  const isAdmin = currentUser?.phone === ADMIN_PHONE;

  const login = useCallback(
    (
      phone: string,
      password: string,
    ): { success: boolean; error?: string; role?: "admin" | "user" } => {
      const cleanPhone = phone.trim();
      const cleanPass = password.trim();

      // Check hardcoded admin
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
        // Set userData for admin
        setUserData((prev) => ({
          ...prev,
          name: "Admin",
          phone: ADMIN_PHONE,
        }));
        return { success: true, role: "admin" };
      }

      // Check registered users from canonical "users" key
      try {
        const stored = localStorage.getItem(USERS_KEY);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const users: any[] = stored ? JSON.parse(stored) : [];
        const found = users.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (u: any) => u.phone === cleanPhone && u.password === cleanPass,
        );
        if (found) {
          const foundAsCurrentUser: CurrentUser = {
            id: found.id,
            name: found.name,
            phone: found.phone,
            password: found.password,
            referralCode: found.referralCode,
            role: found.role ?? "user",
          };
          setCurrentUser(foundAsCurrentUser);
          localStorage.setItem(
            CURRENT_USER_KEY,
            JSON.stringify(foundAsCurrentUser),
          );

          // Resolve userStatus (may be absent in old records)
          const savedUserStatus: UserStatus =
            found.userStatus ?? (found.isActive ? "active" : "inactive");

          // Restore wallet, userStatus, planStatus, paidUser from saved "users" record
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
              (found.selectedPlan ?? found.plan)
                ? (Number(found.selectedPlan ?? found.plan) as
                    | 599
                    | 999
                    | 1999
                    | 2999)
                : null,
            planActive: found.planActive === true,
          }));

          // After login, silently fetch latest values from Firestore to override stale localStorage
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
                // Sync updated Firestore values back to localStorage users array
                saveUserToUsersArray(found.id, {
                  wallet: d.wallet ?? found.wallet,
                  directIncome: d.directIncome ?? found.directIncome,
                  levelIncome: d.levelIncome ?? found.levelIncome,
                  pairIncome: d.pairIncome ?? found.pairIncome,
                  isActive: d.isActive ?? found.isActive,
                  userStatus: d.userStatus ?? found.userStatus,
                  planStatus: d.planStatus ?? found.planStatus,
                  paidUser: d.paidUser ?? found.paidUser,
                });
              })
              .catch(() => {
                // Firestore unreachable — localStorage values used
              });
          }

          return {
            success: true,
            role: found.role ?? "user",
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
    // Before clearing session, sync current wallet/status back to "users" array
    // IMPORTANT: Do NOT change userStatus on logout — only admin can change it
    if (currentUser?.id) {
      saveUserToUsersArray(currentUser.id, {
        wallet: userData.walletBalance,
        isActive: userData.isActive,
        userStatus: userData.userStatus, // preserve admin-set status
        planStatus: userData.planStatus,
        directIncome: userData.directIncome,
        levelIncome: userData.levelIncome,
        pairIncome: userData.pairIncome,
        paidUser: userData.paidUser,
      });
    }
    setCurrentUser(null);
    // Only clear session key — do NOT remove STORAGE_KEY or "users"
    // so userStatus, wallet, and user accounts all persist after logout
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch {
      // ignore
    }
    // Reset in-memory userData to empty for next login
    const fresh = createEmptyData();
    setUserData(fresh);
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

      // Check localStorage for duplicate phone (fast — no Firestore call)
      const stored = localStorage.getItem(USERS_KEY);
      const existingUsers: FirestoreUser[] = stored ? JSON.parse(stored) : [];
      const existing = existingUsers.find((u) => u.phone === cleanPhone);
      if (existing) {
        return {
          success: false,
          error: "Phone number already registered. Please login.",
        };
      }

      // Generate new user id and referral code immediately (no async)
      const newId =
        Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newReferralCode = generateCode();

      // Resolve sponsorId from local users list (no Firestore, no delay)
      const sponsorCode = referralCode?.trim() || null;
      let sponsorId: string | null = sponsorCode;

      // Try to find sponsor's id from local users by referralCode
      if (sponsorCode) {
        const sponsor = existingUsers.find(
          (u) => u.referralCode === sponsorCode,
        );
        if (sponsor) sponsorId = sponsor.id;
      }

      // Build the full user object — saved to localStorage "users" immediately
      const newUserObj: FirestoreUser = {
        id: newId,
        name: cleanName,
        phone: cleanPhone,
        password: cleanPass,
        sponsorId: sponsorId,
        referredBy: sponsorCode, // the referral code used during signup
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
        userStatus: "inactive", // Admin must activate — never auto-activate on registration
        paidUser: false,
        createdAt: Date.now(),
      };

      // Save to localStorage "users" immediately (append, never overwrite)
      if (!existingUsers.find((u: FirestoreUser) => u.id === newId)) {
        existingUsers.push(newUserObj);

        // Update sponsor's left/right child pointer
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
            // Also update parentId on new user
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

      // Write to Firestore if configured (with 5-second timeout to avoid blocking)
      if (isFirebaseConfigured) {
        try {
          await Promise.race([
            setDoc(doc(db, "users", newId), newUserObj),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error("timeout")), 5000),
            ),
          ]);
        } catch {
          // Firestore offline or timed out — localStorage save above is sufficient
        }
      }

      // Set current user session immediately (synchronous)
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

      // Initialize userData — no demo data, status is inactive until admin approves
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
      // Also update currentUser in localStorage
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
      // Note: Firestore write is handled by PlansPage via savePaymentToFirestore()
      // This function only updates local UI state
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

      // NOTE: Do NOT auto-activate user here.
      // User activation only happens when admin approves the order.
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
   * markUserPaid: marks paidUser=true + selectedPlan in Firestore,
   * then credits tiered commission to referrer. Idempotent — won't double-pay.
   * Commission: ₹599→₹100, ₹1999→₹300, ₹2999→₹500
   */
  const REFERRAL_COMMISSION: Record<number, number> = {
    599: 40,
    999: 70,
    1999: 140,
    2999: 210,
  };

  const markUserPaid = useCallback(
    async (planAmount: 599 | 999 | 1999 | 2999) => {
      if (!currentUser?.id) return;
      const commission = REFERRAL_COMMISSION[planAmount] ?? 100;

      // Duplicate guard: check if already paid (from Firestore)
      const userRef = doc(db, "users", currentUser.id);
      let userSnap: Awaited<ReturnType<typeof getDoc>>;
      try {
        userSnap = await getDoc(userRef);
      } catch {
        // Firestore unreachable — update local state only
        setUserData((prev) => ({
          ...prev,
          paidUser: true,
          selectedPlan: planAmount,
          isActive: true,
          userStatus: "active" as UserStatus,
        }));
        if (currentUser.id) {
          saveUserToUsersArray(currentUser.id, {
            paidUser: true,
            selectedPlan: planAmount,
            isActive: true,
            userStatus: "active",
          });
        }
        return;
      }

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

      // Mark user as paid + save selected plan in Firestore
      try {
        await setDoc(
          userRef,
          { paidUser: true, selectedPlan: planAmount },
          { merge: true },
        );
      } catch {
        // ignore write failure — still update locally
      }

      // Update local state
      setUserData((prev) => ({
        ...prev,
        paidUser: true,
        selectedPlan: planAmount,
        isActive: true,
        userStatus: "active" as UserStatus,
      }));

      // Update localStorage users array
      if (currentUser.id) {
        saveUserToUsersArray(currentUser.id, {
          paidUser: true,
          selectedPlan: planAmount,
          isActive: true,
          userStatus: "active",
        });
      }

      // Credit tiered commission to referrer if user was referred
      const referredBy = userSnap.exists()
        ? ((userSnap.data() as Record<string, unknown>)?.referredBy as
            | string
            | undefined)
        : userData.uplineCode;

      if (referredBy && referredBy !== currentUser.referralCode) {
        try {
          const usersRef = collection(db, "users");
          const q = query(usersRef, where("referralCode", "==", referredBy));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const referrerDoc = snap.docs[0];
            const referrerId = referrerDoc.id;
            const referrerRef = doc(db, "users", referrerId);
            // Atomic increment wallet by tiered commission
            await updateDoc(referrerRef, {
              wallet: increment(commission),
            });
            // If referrer is current user (edge case), update local state too
            if (referrerId === currentUser.id) {
              setUserData((prev) => ({
                ...prev,
                walletBalance: prev.walletBalance + commission,
              }));
            }
          }
        } catch {
          // Referrer credit failed silently — don't block user
        }
      }
    },
    [currentUser, userData.uplineCode],
  );

  // Admin actions
  const adminApprovePayment = useCallback(
    (requestId: string) => {
      // Also persist isActive + userStatus to "users" array so it survives logout
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
      // Also update Firestore paymentRequest status
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
        const current = wallets[userId] ?? 0;
        wallets[userId] = current + amount;
        localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
      } catch {
        // ignore
      }
      // If it's the current user, also update in-memory
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

  /**
   * Admin sets a specific user status: "active" | "inactive" | "hold"
   * Updates localStorage "users" array and Firestore (background).
   * If the target is the currently logged-in user, also updates in-memory.
   */
  const adminSetUserStatus = useCallback(
    async (userId: string, status: UserStatus) => {
      // 1. Update localStorage "users" array
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

      // 2. If updating current session user, also update in-memory
      if (currentUser?.id === userId) {
        setUserData((prev) => ({
          ...prev,
          userStatus: status,
          isActive: status === "active",
        }));
      }

      // 3. Try Firestore update if configured (with 5-second timeout)
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
          // ignore — offline or timed out
        }
      }
    },
    [currentUser?.id],
  );

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
