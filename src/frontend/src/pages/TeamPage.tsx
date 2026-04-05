import { Badge } from "@/components/ui/badge";
import { collection, onSnapshot } from "firebase/firestore";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  List,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useGuccora } from "../context/GuccoraContext";
import { db, isFirebaseConfigured } from "../firebase";

type StoredUser = {
  id: string;
  name: string;
  phone: string;
  referralCode: string;
  sponsorId: string | null;
  sponsorCode?: string | null;
  referredBy?: string | null;
  isActive: boolean;
  createdAt: number;
  wallet?: number;
  position?: string | null;
  leftChild?: string | null;
  rightChild?: string | null;
};

type TreeNode = {
  id: string;
  name: string;
  referralCode: string;
  level: number;
  isActive: boolean;
  children: TreeNode[];
};

/**
 * Build binary tree from a map of users using leftChild/rightChild pointers.
 * Level is determined by depth from root.
 */
function buildBinaryTree(
  rootUser: StoredUser,
  userMap: Map<string, StoredUser>,
): TreeNode {
  function toNode(user: StoredUser, depth: number): TreeNode {
    const children: TreeNode[] = [];
    if (user.leftChild) {
      const left = userMap.get(user.leftChild);
      if (left) children.push(toNode(left, depth + 1));
    }
    if (user.rightChild) {
      const right = userMap.get(user.rightChild);
      if (right) children.push(toNode(right, depth + 1));
    }
    return {
      id: user.id,
      name: user.name,
      referralCode: user.referralCode,
      level: depth,
      isActive: user.isActive,
      children,
    };
  }
  return toNode(rootUser, 0);
}

/**
 * Flatten tree into list with levels for the List view.
 * Root (depth=0) is the current user, so we skip it and show depth 1+ as L1, L2...
 */
function flattenTree(
  node: TreeNode,
  result: Array<{
    id: string;
    name: string;
    referralCode: string;
    level: number;
    isActive: boolean;
  }> = [],
): Array<{
  id: string;
  name: string;
  referralCode: string;
  level: number;
  isActive: boolean;
}> {
  for (const child of node.children) {
    result.push({
      id: child.id,
      name: child.name,
      referralCode: child.referralCode,
      level: child.level,
      isActive: child.isActive,
    });
    flattenTree(child, result);
  }
  return result;
}

function MLMTreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const initials = node.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex flex-col items-center"
        style={{ minWidth: "80px" }}
      >
        {/* Level badge (skip for root) */}
        {depth > 0 && (
          <div className="mb-1">
            <span className="text-[8px] font-bold text-gold/70 bg-gold/10 px-1.5 py-0.5 rounded-full border border-gold/20">
              L{depth}
            </span>
          </div>
        )}

        {/* Circle Avatar */}
        <div
          className={`w-12 h-12 rounded-full border-2 flex items-center justify-center mb-1 ${
            node.isActive
              ? "bg-gold/15 border-gold/60"
              : "bg-white/5 border-white/15"
          }`}
        >
          <span
            className={`font-bold text-sm ${
              node.isActive ? "text-gold" : "text-[#606060]"
            }`}
          >
            {initials}
          </span>
        </div>

        {/* Name + Code + Badge */}
        <div className="text-center px-1">
          <p className="text-white font-semibold text-[11px] leading-tight max-w-[80px] truncate">
            {node.name}
          </p>
          <p className="text-gold font-mono text-[9px] mt-0.5">
            {node.referralCode}
          </p>
          <div
            className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
              node.isActive
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/10 text-red-400/70"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${
                node.isActive ? "bg-green-400" : "bg-red-400/60"
              }`}
            />
            {node.isActive ? "Active" : "Inactive"}
          </div>
        </div>

        {/* Expand/collapse */}
        {hasChildren && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 w-5 h-5 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center text-gold hover:bg-gold/20 transition-colors"
            data-ocid="team.tree.toggle"
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center mt-0">
          <div className="w-px h-4 bg-gold/20" />
          {node.children.length > 1 && (
            <div
              className="h-px bg-gold/20"
              style={{ width: `${(node.children.length - 1) * 104}px` }}
            />
          )}
          <div className="flex gap-4 items-start">
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="w-px h-4 bg-gold/20" />
                <MLMTreeNode node={child} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamPage() {
  const { userData, currentUser } = useGuccora();
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");

  // Base users from localStorage (reactive: re-reads on storage changes)
  const [localUsers, setLocalUsers] = useState<StoredUser[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("users") || "[]") as StoredUser[];
    } catch {
      return [];
    }
  });

  // Re-read localStorage whenever it changes (new registrations from same or other tabs)
  useEffect(() => {
    function refreshLocal() {
      try {
        const users = JSON.parse(
          localStorage.getItem("users") || "[]",
        ) as StoredUser[];
        setLocalUsers(users);
      } catch {
        // ignore
      }
    }

    // Poll every 2 seconds to catch same-tab changes (registration doesn't fire storage event)
    const interval = setInterval(refreshLocal, 2000);
    // Also listen for cross-tab changes
    window.addEventListener("storage", refreshLocal);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", refreshLocal);
    };
  }, []);

  // Firestore live users (overrides localStorage when configured)
  const [firestoreUsers, setFirestoreUsers] = useState<StoredUser[]>([]);

  // Subscribe to Firestore users collection for real-time updates
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsub = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const users: StoredUser[] = [];
        for (const docSnap of snapshot.docs) {
          users.push({ id: docSnap.id, ...docSnap.data() } as StoredUser);
        }
        setFirestoreUsers(users);
      },
      () => {
        // Firestore error — fall back to localStorage users
        setFirestoreUsers([]);
      },
    );

    return () => unsub();
  }, []);

  // Merge: Firestore wins on conflict (by id), fallback to local
  const allUsers = useMemo((): StoredUser[] => {
    if (firestoreUsers.length === 0) return localUsers;
    const firestoreIds = new Set(firestoreUsers.map((u) => u.id));
    const localOnly = localUsers.filter((u) => !firestoreIds.has(u.id));
    return [...firestoreUsers, ...localOnly];
  }, [firestoreUsers, localUsers]);

  const currentUserId = currentUser?.id;
  const currentUserReferralCode = userData.referralCode;

  // Direct team: users who used current user's referral code during signup
  const directTeam = useMemo(() => {
    return allUsers.filter(
      (u) =>
        u.referredBy === currentUserReferralCode ||
        u.sponsorId === currentUserReferralCode ||
        u.sponsorId === currentUserId ||
        u.sponsorCode === currentUserReferralCode,
    );
  }, [allUsers, currentUserId, currentUserReferralCode]);

  // Total team: BFS traversal using sponsorId/referralCode linkage
  const totalTeam = useMemo(() => {
    const result: StoredUser[] = [];
    const queue = [...directTeam];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const user = queue.shift()!;
      if (visited.has(user.id)) continue;
      visited.add(user.id);
      result.push(user);
      const downline = allUsers.filter(
        (u) => u.sponsorId === user.referralCode || u.sponsorId === user.id,
      );
      queue.push(...downline);
    }
    return result;
  }, [allUsers, directTeam]);

  // Map of userId → level (1-based, directTeam = L1)
  const levelMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of directTeam) map.set(u.id, 1);
    const queue: Array<{ user: StoredUser; level: number }> = directTeam.map(
      (u) => ({ user: u, level: 1 }),
    );
    const visited = new Set<string>(directTeam.map((u) => u.id));
    while (queue.length > 0) {
      const { user, level } = queue.shift()!;
      const downline = allUsers.filter(
        (u) =>
          u.referredBy === user.referralCode ||
          u.sponsorId === user.referralCode ||
          u.sponsorId === user.id,
      );
      for (const d of downline) {
        if (!visited.has(d.id)) {
          visited.add(d.id);
          map.set(d.id, level + 1);
          queue.push({ user: d, level: level + 1 });
        }
      }
    }
    return map;
  }, [allUsers, directTeam]);

  // Build tree data for tree view (using leftChild/rightChild if available)
  const userMap = useMemo(
    () => new Map(allUsers.map((u) => [u.id, u])),
    [allUsers],
  );

  const currentUserInList = allUsers.find(
    (u) => u.referralCode === currentUserReferralCode || u.id === currentUserId,
  );

  const treeRoot = useMemo(() => {
    if (!currentUserInList) return null;
    // If there are leftChild/rightChild pointers, build binary tree
    const hasTreeData = allUsers.some(
      (u) => u.leftChild != null || u.rightChild != null,
    );
    if (hasTreeData) {
      return buildBinaryTree(currentUserInList, userMap);
    }
    // Otherwise build a flat sponsorId-based tree
    function buildFromSponsor(user: StoredUser, depth: number): TreeNode {
      const children = allUsers
        .filter(
          (u) =>
            u.referredBy === user.referralCode ||
            u.sponsorId === user.referralCode ||
            u.sponsorId === user.id,
        )
        .map((child) => buildFromSponsor(child, depth + 1));
      return {
        id: user.id,
        name: user.name,
        referralCode: user.referralCode,
        level: depth,
        isActive: user.isActive,
        children,
      };
    }
    return buildFromSponsor(currentUserInList, 0);
  }, [currentUserInList, allUsers, userMap]);

  // Flatten tree for list view stats
  const treeList = treeRoot ? flattenTree(treeRoot) : [];
  const directCount = directTeam.length;
  const activeCount = totalTeam.filter((m) => m.isActive).length;
  const totalCount = totalTeam.length;

  function copyReferral() {
    const link = `${window.location.origin}?ref=${userData.referralCode}`;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success("Referral link copied!"));
  }

  return (
    <div className="px-4 py-5 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-white font-black font-display text-2xl">My Team</h1>
        {/* View toggle */}
        <div
          className="flex items-center bg-surface-2 border border-gold/10 rounded-lg p-0.5"
          data-ocid="team.view.toggle"
        >
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              viewMode === "list"
                ? "bg-gold text-black"
                : "text-[#808080] hover:text-white"
            }`}
            data-ocid="team.list.tab"
          >
            <List size={12} /> List
          </button>
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              viewMode === "tree"
                ? "bg-gold text-black"
                : "text-[#808080] hover:text-white"
            }`}
            data-ocid="team.tree.tab"
          >
            <GitBranch size={12} /> Tree
          </button>
        </div>
      </div>
      <p className="text-[#606060] text-sm mb-5">
        Your MLM downline across all levels
      </p>

      {/* Referral */}
      <div
        className="rounded-2xl p-4 border border-gold/20 mb-5"
        style={{ background: "#141414" }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-semibold text-sm">
            Your Referral Link
          </span>
          <button
            type="button"
            onClick={copyReferral}
            className="flex items-center gap-1.5 text-gold text-xs font-semibold bg-gold/10 px-3 py-1.5 rounded-lg"
            data-ocid="team.copy_referral.button"
          >
            <Copy size={12} /> Copy Link
          </button>
        </div>
        <div
          className="rounded-lg px-3 py-2 border border-gold/10"
          style={{ background: "#0A0A0A" }}
        >
          <p className="text-[#A0A0A0] text-xs truncate">
            {window.location.origin}?ref={userData.referralCode}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Direct", value: directCount, icon: Users },
          { label: "Total Team", value: totalCount, icon: Users },
          { label: "Active", value: activeCount, icon: CheckCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl p-3 border border-gold/10 text-center"
            style={{ background: "#141414" }}
          >
            <Icon size={16} className="text-gold mx-auto mb-1" />
            <div className="text-white font-black text-xl font-display">
              {value}
            </div>
            <div className="text-[#606060] text-xs">{label}</div>
          </div>
        ))}
      </div>

      {viewMode === "list" ? (
        /* List View */
        <div
          className="rounded-2xl border border-gold/10 overflow-hidden"
          style={{ background: "#141414" }}
          data-ocid="team.members.table"
        >
          <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm">Team Members</h2>
            <Badge className="bg-gold/10 text-gold border-gold/20 text-[9px]">
              {totalCount} members
            </Badge>
          </div>

          {totalTeam.length === 0 ? (
            <div
              className="text-center py-10 text-[#606060]"
              data-ocid="team.members.empty_state"
            >
              <Users size={32} className="mx-auto mb-3 text-gold/20" />
              <p className="text-sm">No team members yet</p>
              <p className="text-xs mt-1">
                Share your referral link to grow your team
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {totalTeam.map((member, idx) => {
                const level = levelMap.get(member.id) ?? 1;
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-4 py-3"
                    data-ocid={`team.member.item.${idx + 1}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-gold font-bold text-sm">
                        {member.name[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {member.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#606060] text-xs">L{level}</span>
                        <span className="text-[#606060] text-[10px] font-mono">
                          {member.referralCode}
                        </span>
                      </div>
                    </div>
                    {member.isActive ? (
                      <CheckCircle
                        size={16}
                        className="text-green-400 flex-shrink-0"
                      />
                    ) : (
                      <XCircle
                        size={16}
                        className="text-red-400/60 flex-shrink-0"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Tree View */
        <div
          className="rounded-2xl border border-gold/10 overflow-hidden"
          style={{ background: "#141414" }}
          data-ocid="team.tree.panel"
        >
          <div className="px-4 py-3 border-b border-gold/10 flex items-center gap-2">
            <GitBranch size={14} className="text-gold" />
            <h2 className="text-white font-semibold text-sm">Network Tree</h2>
            <Badge className="ml-auto bg-gold/10 text-gold border-gold/20 text-[9px]">
              {treeList.length + 1} nodes
            </Badge>
          </div>

          {!treeRoot ? (
            <div
              className="text-center py-10 text-[#606060]"
              data-ocid="team.tree.empty_state"
            >
              <GitBranch size={32} className="mx-auto mb-3 text-gold/20" />
              <p className="text-sm">No team members yet</p>
              <p className="text-xs mt-1">
                Share your referral link to start your tree
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto p-5">
              <div
                className="flex justify-center"
                style={{ minWidth: "max-content" }}
              >
                <MLMTreeNode node={treeRoot} depth={0} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
