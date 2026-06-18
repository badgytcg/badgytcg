"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getCardById } from "@/data/cards";
import { CartLine, WishlistLine } from "@/lib/types";

interface StoreState {
  cart: CartLine[];
  wishlist: WishlistLine[];
  addToCart: (cardId: string, qty: number) => void;
  removeFromCart: (cardId: string) => void;
  setCartQty: (cardId: string, qty: number) => void;
  addManyToCart: (lines: CartLine[]) => void;
  addToWishlist: (lines: WishlistLine[]) => void;
  removeFromWishlist: (index: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

const StoreContext = createContext<StoreState | null>(null);

const CART_KEY = "vibes-tcg:cart";
const WISHLIST_KEY = "vibes-tcg:wishlist";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<WishlistLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(load(CART_KEY, []));
    setWishlist(load(WISHLIST_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  function addToCart(cardId: string, qty: number) {
    setCart((prev) => {
      const existing = prev.find((l) => l.cardId === cardId);
      if (existing) {
        return prev.map((l) =>
          l.cardId === cardId ? { ...l, qty: l.qty + qty } : l
        );
      }
      return [...prev, { cardId, qty }];
    });
  }

  function addManyToCart(lines: CartLine[]) {
    setCart((prev) => {
      const next = [...prev];
      for (const line of lines) {
        const idx = next.findIndex((l) => l.cardId === line.cardId);
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: next[idx].qty + line.qty };
        } else {
          next.push(line);
        }
      }
      return next;
    });
  }

  function addToWishlist(lines: WishlistLine[]) {
    setWishlist((prev) => [...prev, ...lines]);
  }

  function removeFromWishlist(index: number) {
    setWishlist((prev) => prev.filter((_, i) => i !== index));
  }

  function removeFromCart(cardId: string) {
    setCart((prev) => prev.filter((l) => l.cardId !== cardId));
  }

  function setCartQty(cardId: string, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.cardId !== cardId)
        : prev.map((l) => (l.cardId === cardId ? { ...l, qty } : l))
    );
  }

  function clearCart() {
    setCart([]);
  }

  const cartCount = useMemo(() => cart.reduce((sum, l) => sum + l.qty, 0), [cart]);
  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, l) => {
        const card = getCardById(l.cardId);
        return sum + (card ? card.price * l.qty : 0);
      }, 0),
    [cart]
  );

  return (
    <StoreContext.Provider
      value={{
        cart,
        wishlist,
        addToCart,
        removeFromCart,
        setCartQty,
        addManyToCart,
        addToWishlist,
        removeFromWishlist,
        clearCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
