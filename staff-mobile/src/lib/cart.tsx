import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartBranding = {
  logoUrl?: string | null;
  primaryColor?: string | null;
  tagline?: string | null;
};

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
  quantity: number;
};

export type CartStore = {
  businessId: string;
  businessName: string;
  branding?: CartBranding;
  lines: CartLine[];
};

export type CartState = {
  stores: CartStore[];
};

type ProductInput = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  category?: string | null;
};

type BusinessInput = { id: string; name: string; branding?: CartBranding };

type CartContextValue = {
  cart: CartState | null;
  stores: CartStore[];
  itemCount: number;
  subtotal: number;
  storeCount: (businessId: string) => number;
  storeSubtotal: (businessId: string) => number;
  addItem: (business: BusinessInput, product: ProductInput, qty?: number) => void;
  setQty: (businessId: string, productId: string, quantity: number) => void;
  removeItem: (businessId: string, productId: string) => void;
  clearStore: (businessId: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "kaarobar.consumer.cart.v2";
const LEGACY_KEY = "kaarobar.consumer.cart.v1";

const CartContext = createContext<CartContextValue | null>(null);

function upsertLine(lines: CartLine[], line: CartLine): CartLine[] {
  const idx = lines.findIndex((l) => l.productId === line.productId);
  if (idx < 0) return [...lines, line];
  const next = [...lines];
  next[idx] = {
    ...next[idx],
    quantity: next[idx].quantity + line.quantity,
    price: line.price,
    name: line.name,
    imageUrl: line.imageUrl ?? next[idx].imageUrl,
    category: line.category ?? next[idx].category,
  };
  return next;
}

function normalizeCart(raw: unknown): CartState | null {
  if (!raw || typeof raw !== "object") return null;
  const asV2 = raw as CartState;
  if (Array.isArray(asV2.stores)) {
    const stores = asV2.stores.filter(
      (s) => s?.businessId && Array.isArray(s.lines) && s.lines.length > 0
    );
    return stores.length > 0 ? { stores } : null;
  }
  const asV1 = raw as {
    businessId?: string;
    businessName?: string;
    branding?: CartBranding;
    lines?: CartLine[];
  };
  if (asV1.businessId && Array.isArray(asV1.lines) && asV1.lines.length > 0) {
    return {
      stores: [
        {
          businessId: asV1.businessId,
          businessName: asV1.businessName || "Store",
          branding: asV1.branding,
          lines: asV1.lines,
        },
      ],
    };
  }
  return null;
}

function prune(stores: CartStore[]): CartState | null {
  const next = stores.filter((s) => s.lines.length > 0);
  return next.length === 0 ? null : { stores: next };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const v2 = await AsyncStorage.getItem(STORAGE_KEY);
        if (v2) {
          setCart(normalizeCart(JSON.parse(v2)));
        } else {
          const v1 = await AsyncStorage.getItem(LEGACY_KEY);
          if (v1) {
            const migrated = normalizeCart(JSON.parse(v1));
            setCart(migrated);
            if (migrated) {
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
              await AsyncStorage.removeItem(LEGACY_KEY);
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        if (!cart || cart.stores.length === 0) {
          await AsyncStorage.multiRemove([STORAGE_KEY, LEGACY_KEY]);
        } else {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
          await AsyncStorage.removeItem(LEGACY_KEY);
        }
      } catch {
        // ignore
      }
    })();
  }, [cart, hydrated]);

  const addItem = useCallback((business: BusinessInput, product: ProductInput, qty = 1) => {
    const quantity = Math.max(1, Math.floor(qty));
    const line: CartLine = {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      category: product.category,
      quantity,
    };
    setCart((prev) => {
      const stores = prev?.stores ? [...prev.stores] : [];
      const idx = stores.findIndex((s) => s.businessId === business.id);
      if (idx < 0) {
        stores.push({
          businessId: business.id,
          businessName: business.name,
          branding: business.branding,
          lines: [line],
        });
      } else {
        stores[idx] = {
          ...stores[idx],
          businessName: business.name,
          branding: business.branding ?? stores[idx].branding,
          lines: upsertLine(stores[idx].lines, line),
        };
      }
      return prune(stores);
    });
  }, []);

  const setQty = useCallback((businessId: string, productId: string, quantity: number) => {
    setCart((prev) => {
      if (!prev) return prev;
      const stores = prev.stores.map((store) => {
        if (store.businessId !== businessId) return store;
        if (quantity <= 0) {
          return { ...store, lines: store.lines.filter((l) => l.productId !== productId) };
        }
        return {
          ...store,
          lines: store.lines.map((l) =>
            l.productId === productId ? { ...l, quantity: Math.floor(quantity) } : l
          ),
        };
      });
      return prune(stores);
    });
  }, []);

  const removeItem = useCallback((businessId: string, productId: string) => {
    setCart((prev) => {
      if (!prev) return prev;
      return prune(
        prev.stores.map((store) =>
          store.businessId === businessId
            ? { ...store, lines: store.lines.filter((l) => l.productId !== productId) }
            : store
        )
      );
    });
  }, []);

  const clearStore = useCallback((businessId: string) => {
    setCart((prev) => {
      if (!prev) return prev;
      return prune(prev.stores.filter((s) => s.businessId !== businessId));
    });
  }, []);

  const clear = useCallback(() => setCart(null), []);

  // Memoised because the `?? []` fallback would otherwise be a fresh array on
  // every render, invalidating every derived memo/callback below.
  const stores = useMemo(() => cart?.stores ?? [], [cart]);

  const itemCount = useMemo(
    () => stores.reduce((s, store) => s + store.lines.reduce((a, l) => a + l.quantity, 0), 0),
    [stores]
  );

  const subtotal = useMemo(
    () =>
      stores.reduce(
        (s, store) => s + store.lines.reduce((a, l) => a + l.quantity * l.price, 0),
        0
      ),
    [stores]
  );

  const storeCount = useCallback(
    (businessId: string) => {
      const store = stores.find((s) => s.businessId === businessId);
      return store?.lines.reduce((a, l) => a + l.quantity, 0) ?? 0;
    },
    [stores]
  );

  const storeSubtotal = useCallback(
    (businessId: string) => {
      const store = stores.find((s) => s.businessId === businessId);
      return store?.lines.reduce((a, l) => a + l.quantity * l.price, 0) ?? 0;
    },
    [stores]
  );

  const value = useMemo(
    () => ({
      cart,
      stores,
      itemCount,
      subtotal,
      storeCount,
      storeSubtotal,
      addItem,
      setQty,
      removeItem,
      clearStore,
      clear,
    }),
    [
      cart,
      stores,
      itemCount,
      subtotal,
      storeCount,
      storeSubtotal,
      addItem,
      setQty,
      removeItem,
      clearStore,
      clear,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function useCartOptional(): CartContextValue | null {
  return useContext(CartContext);
}
