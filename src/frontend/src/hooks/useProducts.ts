import { useCallback, useState } from "react";

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

function loadProducts(): Product[] {
  try {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (stored) return JSON.parse(stored) as Product[];
  } catch {
    // ignore
  }
  return [];
}

function saveProducts(products: Product[]): void {
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  } catch {
    // ignore
  }
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>(loadProducts);

  const addProduct = useCallback((data: Omit<Product, "id" | "createdAt">) => {
    const newProduct: Product = {
      ...data,
      id: generateId(),
      createdAt: Date.now(),
    };
    setProducts((prev) => {
      const next = [newProduct, ...prev];
      saveProducts(next);
      return next;
    });
  }, []);

  const updateProduct = useCallback(
    (id: string, data: Partial<Omit<Product, "id" | "createdAt">>) => {
      setProducts((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, ...data } : p));
        saveProducts(next);
        return next;
      });
    },
    [],
  );

  const deleteProduct = useCallback((id: string) => {
    setProducts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveProducts(next);
      return next;
    });
  }, []);

  return { products, addProduct, updateProduct, deleteProduct };
}
