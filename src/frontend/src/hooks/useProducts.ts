import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db, isFirebaseConfigured } from "../firebase";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageDataUrl: string;
  planType: "starter" | "silver" | "gold" | "platinum";
  createdAt: number;
};

const PRODUCTS_KEY = "guccora_products";

function loadProductsFromStorage(): Product[] {
  try {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (stored) return JSON.parse(stored) as Product[];
  } catch {
    // ignore
  }
  return [];
}

function saveProductsToStorage(products: Product[]): void {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch {
    // ignore
  }
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(loadProductsFromStorage);
  // Track whether Firestore has delivered at least one non-empty snapshot
  const firestoreLoadedRef = useRef(false);

  // Subscribe to Firestore products collection in real time
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    // Query all products ordered by createdAt descending
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Map ALL docs — never filter or skip
        const firestoreProducts: Product[] = snapshot.docs.map(
          (docSnap) =>
            ({
              id: docSnap.id,
              ...docSnap.data(),
            }) as Product,
        );

        // Mark Firestore as having delivered data (even if empty)
        firestoreLoadedRef.current = true;

        // Always replace state with what Firestore says is the full collection
        // This is correct — Firestore sends the FULL snapshot every time
        setProducts(firestoreProducts);
        saveProductsToStorage(firestoreProducts);
      },
      () => {
        // Firestore error — fall back to localStorage only if we haven't
        // received a valid Firestore snapshot yet
        if (!firestoreLoadedRef.current) {
          const local = loadProductsFromStorage();
          if (local.length > 0) setProducts(local);
        }
      },
    );

    return () => unsub();
  }, []);

  const addProduct = useCallback(
    async (data: Omit<Product, "id" | "createdAt">) => {
      if (isFirebaseConfigured) {
        try {
          // addDoc creates a NEW document with a unique auto-generated ID
          // serverTimestamp() ensures correct ordering on the server
          await addDoc(collection(db, "products"), {
            ...data,
            createdAt: serverTimestamp(),
          });
          // onSnapshot will automatically update state with the new product
          // No need to manually update state here
        } catch (err) {
          console.error("Firestore addProduct failed:", err);
          // Fallback: add to localStorage only
          const localProduct: Product = {
            ...data,
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: Date.now(),
          };
          setProducts((prev) => {
            const next = [localProduct, ...prev];
            saveProductsToStorage(next);
            return next;
          });
        }
      } else {
        // No Firebase — use localStorage only
        const localProduct: Product = {
          ...data,
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: Date.now(),
        };
        setProducts((prev) => {
          const next = [localProduct, ...prev];
          saveProductsToStorage(next);
          return next;
        });
      }
    },
    [],
  );

  const updateProduct = useCallback(
    (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      // Update local state immediately
      setProducts((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
        saveProductsToStorage(next);
        return next;
      });

      // Sync to Firestore for real documents (not local-only)
      if (isFirebaseConfigured && !id.startsWith("local_")) {
        updateDoc(doc(db, "products", id), data).catch(() => {
          // ignore — local state already updated
        });
      }
    },
    [],
  );

  const deleteProduct = useCallback((id: string) => {
    // Remove from local state immediately
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProductsToStorage(next);
      return next;
    });

    // Delete from Firestore for real documents
    if (isFirebaseConfigured && !id.startsWith("local_")) {
      deleteDoc(doc(db, "products", id)).catch(() => {
        // ignore
      });
    }
  }, []);

  return { products, addProduct, updateProduct, deleteProduct };
}
