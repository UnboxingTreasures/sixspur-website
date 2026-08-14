'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Client-side only, matching the Aug 14 2026 scoping decision: cart
// state lives in the browser (localStorage) until the person actually
// checks out. At checkout, the whole cart array below gets sent to
// POST /orders/create-order, which is where real server-side stock
// reservation happens -- nothing here ever touches DynamoDB.

export interface CartItem {
  // itemId + comboIndex together uniquely identify a cart line -- two
  // different variants of the same product are separate lines, but
  // adding the SAME variant twice increases quantity on the existing
  // line instead of creating a duplicate.
  itemId: string;
  comboIndex?: number; // index into that product's combinations[] array, only set for variant products
  name: string;
  price: number;
  thumbnailUrl: string;
  quantity: number;
  variantLabel?: string; // human-readable, e.g. "Small / Black/Grey", for display only
  maxStock: number; // soft client-side cap from the last known stock number -- real enforcement is the atomic reservation at checkout, this just avoids obviously-wrong quantities in the cart UI
}

interface CartContextValue {
  items: CartItem[];
  cartCount: number; // total quantity across all lines, shown in the Nav badge
  subtotal: number;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  updateQuantity: (itemId: string, comboIndex: number | undefined, quantity: number) => void;
  removeItem: (itemId: string, comboIndex: number | undefined) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'sixspur_cart';

function sameLine(a: { itemId: string; comboIndex?: number }, b: { itemId: string; comboIndex?: number }) {
  return a.itemId === b.itemId && a.comboIndex === b.comboIndex;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage once on mount. Guarded by `hydrated` so the
  // save effect below doesn't immediately fire and overwrite storage
  // with an empty array before this read completes.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (err) {
      console.error('Failed to load cart from storage:', err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save cart to storage:', err);
    }
  }, [items, hydrated]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity: number) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((line) => sameLine(line, item));
      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQty = Math.min(updated[existingIndex].quantity + quantity, item.maxStock);
        updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
        return updated;
      }
      return [...prev, { ...item, quantity: Math.min(quantity, item.maxStock) }];
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, comboIndex: number | undefined, quantity: number) => {
    setItems((prev) => prev.map((line) => {
      if (!sameLine(line, { itemId, comboIndex })) return line;
      return { ...line, quantity: Math.max(1, Math.min(quantity, line.maxStock)) };
    }));
  }, []);

  const removeItem = useCallback((itemId: string, comboIndex: number | undefined) => {
    setItems((prev) => prev.filter((line) => !sameLine(line, { itemId, comboIndex })));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const cartCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = Math.round(items.reduce((sum, line) => sum + line.price * line.quantity, 0) * 100) / 100;

  return (
    <CartContext.Provider value={{ items, cartCount, subtotal, addItem, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
