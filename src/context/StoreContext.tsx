"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { cards as staticCards, getCardById as getStaticCardById } from "@/data/cards";
import { Card, CartLine, WishlistLine } from "@/lib/types";

interface StoreState {
  cart: CartLine[];
  wishlist: WishlistLine[];
  catalog: Card[]; // live (admin-editable) price/stock, falls back to the static bundle while loading
  getCardById: (id: string) => Card | undefined;
  addToCart: (cardId: string, qty: number) => void;
  removeFromCart: (cardId: string) => void;
  setCartQty: (cardId: string, qty: number) => void;
  addManyToCart: (lines: CartLine[]) => void;
  addToWishlist: (lines: WishlistLine[]) => Promise<void>;
  removeFromWishlist: (index: number) => Promise<void>;
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

interface DbWishlistItem {
  id: string;
  cardId: string | null;
  cardName: string;
  qty: number;
  note: string | null;
}

function fromDb(item: DbWishlistItem): WishlistLine {
  return {
    dbId: item.id,
    cardId: item.cardId,
    cardName: item.cardName,
    qty: item.qty,
    note: item.note ?? undefined,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<WishlistLine[]>([]);
  const [catalog, setCatalog] = useState<Card[]>(staticCards);
  // Foil ("{id}::foil") and special ("special::{id}") cart lines aren't in
  // the base catalog, so fetch+cache them individually as they show up.
  const [extraCards, setExtraCards] = useState<Record<string, Card>>({});
  const [hydrated, setHydrated] = useState(false);

  // Cart stays local-only for now (no checkout yet to attach it to an account).
  useEffect(() => {
    setCart(load(CART_KEY, []));
    setHydrated(true);
  }, []);

  // Live (admin-editable) price/stock, so cart totals and stock limits
  // reflect what's actually in the database, not just the build-time bundle.
  useEffect(() => {
    fetch("/api/cards")
      .then((res) => res.json())
      .then((data) => setCatalog(data.cards ?? staticCards));
  }, []);

  const getCardById = useCallback(
    (id: string) => catalog.find((c) => c.id === id) ?? getStaticCardById(id) ?? extraCards[id],
    [catalog, extraCards]
  );

  // Backfill foil/special cards referenced by the cart but not present in
  // the base catalog or static bundle.
  useEffect(() => {
    const missing = cart
      .map((l) => l.cardId)
      .filter((id) => !catalog.some((c) => c.id === id) && !getStaticCardById(id) && !extraCards[id]);
    if (missing.length === 0) return;

    Promise.all(
      missing.map((id) =>
        fetch(`/api/cards/${encodeURIComponent(id)}`).then((res) => (res.ok ? res.json() : null))
      )
    ).then((results) => {
      setExtraCards((prev) => {
        const next = { ...prev };
        results.forEach((r, i) => {
          if (r?.card) next[missing[i]] = r.card;
        });
        return next;
      });
    });
  }, [cart, catalog, extraCards]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  const refetchWishlist = useCallback(async () => {
    const res = await fetch("/api/wishlist");
    const data = await res.json();
    setWishlist((data.items as DbWishlistItem[]).map(fromDb));
  }, []);

  // Guest wishlist lives in localStorage. On sign-in, migrate any local
  // items up to the account once, then switch to the server as the source
  // of truth.
  useEffect(() => {
    if (status === "loading") return;

    if (!signedIn) {
      setWishlist(load(WISHLIST_KEY, []));
      return;
    }

    (async () => {
      const local = load<WishlistLine[]>(WISHLIST_KEY, []);
      if (local.length > 0) {
        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: local }),
        });
        window.localStorage.removeItem(WISHLIST_KEY);
      }
      await refetchWishlist();
    })();
  }, [signedIn, status, refetchWishlist]);

  useEffect(() => {
    if (!signedIn && hydrated) {
      window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
    }
  }, [wishlist, hydrated, signedIn]);

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

  async function addToWishlist(lines: WishlistLine[]) {
    if (signedIn) {
      await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      await refetchWishlist();
    } else {
      setWishlist((prev) => [...prev, ...lines]);
    }
  }

  async function removeFromWishlist(index: number) {
    const line = wishlist[index];
    if (signedIn && line?.dbId) {
      await fetch(`/api/wishlist/${line.dbId}`, { method: "DELETE" });
      await refetchWishlist();
    } else {
      setWishlist((prev) => prev.filter((_, i) => i !== index));
    }
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
    [cart, getCardById]
  );

  return (
    <StoreContext.Provider
      value={{
        cart,
        wishlist,
        catalog,
        getCardById,
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
