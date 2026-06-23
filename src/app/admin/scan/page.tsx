"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Card } from "@/lib/types";

type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "matched"; card: Card; rawText: string }
  | { status: "unmatched"; rawText: string }
  | { status: "error"; message: string };

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, data] = result.split(",");
      const mediaType = header.match(/data:(.*);base64/)?.[1] ?? file.type;
      resolve({ data, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminScanPage() {
  const [state, setState] = useState<ScanState>({ status: "idle" });
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState({ status: "scanning" });
    setQty(1);
    setSaved(false);
    try {
      const { data, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data, mediaType }),
      });
      const result = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: result.error ?? "Scan failed." });
        return;
      }
      if (result.card) {
        setState({ status: "matched", card: result.card, rawText: result.rawText });
      } else {
        setState({ status: "unmatched", rawText: result.rawText });
      }
    } catch {
      setState({ status: "error", message: "Couldn't read that photo. Try again." });
    }
  }

  async function addToStock() {
    if (state.status !== "matched") return;
    setSaving(true);
    await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: state.card.id,
        price: state.card.price,
        stock: state.card.stock + qty,
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  function scanNext() {
    setState({ status: "idle" });
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Scan a Card</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Photograph one card at a time, name-side up. I&apos;ll read the printed name and match it
        against your catalog so you can add it to stock without typing.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        id="scan-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <label
        htmlFor="scan-input"
        className="mb-6 block w-full cursor-pointer rounded-lg bg-purple-600 py-3 text-center text-sm font-medium text-white hover:bg-purple-500"
      >
        {state.status === "idle" ? "Take a Photo" : "Take Another Photo"}
      </label>

      {state.status === "scanning" && (
        <p className="text-center text-sm text-zinc-400">Reading card...</p>
      )}

      {state.status === "error" && (
        <p className="text-center text-sm text-red-400">{state.message}</p>
      )}

      {state.status === "unmatched" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
          <p className="text-sm text-zinc-400">
            Read &quot;<span className="text-zinc-200">{state.rawText}</span>&quot; but couldn&apos;t
            match it to a card in the catalog.
          </p>
          <p className="mt-2 text-xs text-zinc-500">Try a clearer photo, or add it manually in Inventory.</p>
        </div>
      )}

      {state.status === "matched" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex gap-4">
            <div className="relative h-28 w-20 flex-shrink-0 overflow-hidden rounded bg-zinc-800">
              <Image src={state.card.image} alt={state.card.name} fill sizes="80px" className="object-contain" unoptimized />
            </div>
            <div>
              <p className="font-semibold text-zinc-100">{state.card.name}</p>
              <p className="text-xs text-zinc-500">{state.card.set} · {state.card.rarity}</p>
              <p className="mt-1 text-sm text-zinc-400">Current stock: {state.card.stock}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <label className="text-sm text-zinc-400">Add</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm text-zinc-100"
            />
            <span className="text-sm text-zinc-400">to stock (→ {state.card.stock + qty} total)</span>
          </div>

          <button
            onClick={addToStock}
            disabled={saving || saved}
            className="mt-4 w-full rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
          >
            {saved ? "Added!" : saving ? "Saving..." : `Add ${qty} to stock`}
          </button>

          {saved && (
            <button
              onClick={scanNext}
              className="mt-2 w-full rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:border-purple-500"
            >
              Scan next card
            </button>
          )}
        </div>
      )}
    </div>
  );
}
