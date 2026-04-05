import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
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

function generateId(): string {
  return Math.random().toString(36).substring(2, 12);
}

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

  // Subscribe to Firestore products if configured
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsub = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const firestoreProducts: Product[] = [];
        for (const docSnap of snapshot.docs) {
          firestoreProducts.push({
            id: docSnap.id,
            ...docSnap.data(),
          } as Product);
        }
        // Sort by createdAt descending
        firestoreProducts.sort(
          (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
        );
        setProducts(firestoreProducts);
        saveProductsToStorage(firestoreProducts);
      },
      () => {
        // Firestore error — fall back to localStorage
        setProducts(loadProductsFromStorage());
      },
    );

    return () => unsub();
  }, []);

  const addProduct = useCallback((data: Omit<Product, "id" | "createdAt">) => {
    const newProduct: Product = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
    };

    // Optimistically update localStorage and state
    setProducts((prev) => {
      const next = [newProduct, ...prev];
      saveProductsToStorage(next);
      return next;
    });

    // Write to Firestore if configured
    if (isFirebaseConfigured) {
      setDoc(doc(db, "products", newProduct.id), newProduct).catch(() => {
        // ignore — localStorage already updated
      });
    }
  }, []);

  const updateProduct = useCallback(
    (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      setProducts((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
        saveProductsToStorage(next);
        return next;
      });

      // Update in Firestore if configured
      if (isFirebaseConfigured) {
        updateDoc(doc(db, "products", id), data).catch(() => {
          // ignore
        });
      }
    },
    [],
  );

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProductsToStorage(next);
      return next;
    });

    // Delete from Firestore if configured
    if (isFirebaseConfigured) {
      deleteDoc(doc(db, "products", id)).catch(() => {
        // ignore
      });
    }
  }, []);

  return { products, addProduct, updateProduct, deleteProduct };
}
