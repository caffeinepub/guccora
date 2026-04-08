import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "../firebase";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  planType: "starter" | "silver" | "gold" | "platinum";
  createdAt: number;
};

export function useProducts() {
  // Firestore is the ONLY source of truth — no localStorage dependency
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Firestore onSnapshot always delivers the FULL collection
        const firestoreProducts: Product[] = snapshot.docs.map(
          (docSnap) =>
            ({
              id: docSnap.id,
              ...docSnap.data(),
            }) as Product,
        );

        console.log(
          "[useProducts] Firestore snapshot:",
          firestoreProducts.length,
          "products",
          firestoreProducts.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
          })),
        );

        setProducts(firestoreProducts);
        setLoading(false);

        // Keep localStorage in sync as a readonly fallback cache
        try {
          localStorage.setItem(
            "guccora_products",
            JSON.stringify(firestoreProducts),
          );
        } catch {
          // ignore storage errors
        }
      },
      (err) => {
        console.error("[useProducts] Firestore onSnapshot error:", err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, []);

  const addProduct = useCallback(
    async (data: Omit<Product, "id" | "createdAt">) => {
      // Date.now() instead of serverTimestamp() so orderBy("createdAt") works immediately
      const createdAt = Date.now();
      try {
        const docRef = await addDoc(collection(db, "products"), {
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.imageUrl,
          planType: data.planType,
          createdAt,
        });
        console.log("[useProducts] addDoc success, new ID:", docRef.id);
      } catch (err) {
        console.error("[useProducts] addDoc failed:", err);
        throw err;
      }
    },
    [],
  );

  const updateProduct = useCallback(
    async (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      try {
        await updateDoc(doc(db, "products", id), data);
      } catch (err) {
        console.error("[useProducts] updateDoc failed:", err);
        throw err;
      }
    },
    [],
  );

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, "products", id));
    } catch (err) {
      console.error("[useProducts] deleteDoc failed:", err);
      throw err;
    }
  }, []);

  return { products, loading, addProduct, updateProduct, deleteProduct };
}
