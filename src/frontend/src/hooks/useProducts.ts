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
  imageDataUrl: string;
  planType: "starter" | "silver" | "gold" | "platinum";
  createdAt: number;
};

export function useProducts() {
  // Start with empty array — Firestore is the only source of truth
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Always connect to Firestore — db is always initialized with real config
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        // Map ALL docs in the snapshot — Firestore sends the FULL collection every time
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

        // Replace state completely — never merge, never append manually.
        // Firestore's onSnapshot always delivers the full current collection.
        setProducts(firestoreProducts);
        setLoading(false);
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
      // Date.now() instead of serverTimestamp() so the value is immediately
      // available and orderBy("createdAt") works from the very first snapshot.
      const createdAt = Date.now();

      try {
        // addDoc() ALWAYS creates a brand-new document with a unique auto-generated ID.
        // It NEVER overwrites an existing document — each call = one new product.
        const docRef = await addDoc(collection(db, "products"), {
          name: data.name,
          description: data.description,
          price: data.price,
          imageDataUrl: data.imageDataUrl,
          planType: data.planType,
          createdAt,
        });
        console.log("[useProducts] addDoc success, new ID:", docRef.id);
        // onSnapshot above will fire automatically and update products state
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
        // onSnapshot will update state automatically
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
      // onSnapshot will remove it from state automatically
    } catch (err) {
      console.error("[useProducts] deleteDoc failed:", err);
      throw err;
    }
  }, []);

  return { products, loading, addProduct, updateProduct, deleteProduct };
}
