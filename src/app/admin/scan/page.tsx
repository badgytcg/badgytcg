"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/lib/types";

const SCAN_INTERVAL_MS = 1200;
const COOLDOWN_MS = 2500; // pause after confirming so the same card isn't double-counted

type Flash = "none" | "success";

function playDing() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Audio isn't critical to the flow — ignore if the browser blocks it.
  }
}

export default function AdminScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const cooldownRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>("none");
  const [scanCount, setScanCount] = useState(0);

  // A match pauses scanning until the qty is confirmed — that's what lets
  // you key in "I have 4 of these" instead of always adding 1.
  const [pendingMatch, setPendingMatch] = useState<Card | null>(null);
  const [pendingQty, setPendingQty] = useState("1");
  const [saving, setSaving] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ card: Card; qty: number; newStock: number } | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError("Couldn't access the camera. Check your browser's camera permission for this site.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraOn(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (pendingMatch) {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }
  }, [pendingMatch]);

  const captureAndScan = useCallback(async () => {
    if (processingRef.current || cooldownRef.current || pendingMatch) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    processingRef.current = true;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    const base64 = dataUrl.split(",")[1];

    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: "image/jpeg" }),
      });
      const result = await res.json();
      setScanCount((n) => n + 1);

      if (res.ok && result.card) {
        playDing();
        setFlash("success");
        setPendingMatch(result.card);
        setPendingQty("1");
      }
    } catch {
      // Silently retry on the next tick — a single failed frame isn't worth surfacing.
    } finally {
      processingRef.current = false;
    }
  }, [pendingMatch]);

  async function confirmAdd() {
    if (!pendingMatch) return;
    const qty = Math.max(1, Math.round(Number(pendingQty)) || 1);
    const newStock = pendingMatch.stock + qty;

    setSaving(true);
    await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId: pendingMatch.id, price: pendingMatch.price, stock: newStock }),
    });
    setSaving(false);
    setLastAdded({ card: pendingMatch, qty, newStock });
    setPendingMatch(null);
    setFlash("none");

    cooldownRef.current = true;
    setTimeout(() => {
      cooldownRef.current = false;
    }, COOLDOWN_MS);
  }

  function cancelMatch() {
    setPendingMatch(null);
    setFlash("none");
  }

  useEffect(() => {
    if (!cameraOn) return;
    const id = setInterval(captureAndScan, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cameraOn, captureAndScan]);

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Scan Cards</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Point the camera at a card. On a match you&apos;ll hear a ding and the border flashes green —
        type how many copies you have and confirm, then it resumes scanning for the next card.
      </p>

      <div
        className={`relative mb-4 aspect-square overflow-hidden rounded-xl border-4 bg-zinc-900 transition-colors ${
          flash === "success" ? "border-green-500" : "border-zinc-800"
        }`}
      >
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <button
              onClick={startCamera}
              className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
            >
              Start Camera
            </button>
          </div>
        )}
      </div>

      {cameraError && <p className="mb-4 text-sm text-red-400">{cameraError}</p>}

      {cameraOn && !pendingMatch && (
        <button
          onClick={stopCamera}
          className="mb-4 w-full rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
        >
          Stop Camera
        </button>
      )}

      <p className="mb-4 text-center text-xs text-zinc-500">{scanCount} frame(s) checked this session</p>

      {pendingMatch && (
        <div className="rounded-xl border border-green-700/50 bg-zinc-900 p-4">
          <p className="text-sm font-semibold text-green-400">✓ Matched</p>
          <p className="mt-1 text-zinc-100">{pendingMatch.name}</p>
          <p className="text-xs text-zinc-500">{pendingMatch.set} · {pendingMatch.rarity}</p>
          <p className="mt-1 text-sm text-zinc-400">Current stock: {pendingMatch.stock}</p>

          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm text-zinc-400">How many do you have?</label>
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setPendingQty((q) => String(Math.max(1, (Number(q) || 1) - 1)))}
                className="h-8 w-8 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500"
              >
                −
              </button>
              <input
                ref={qtyInputRef}
                type="number"
                min={1}
                value={pendingQty}
                onChange={(e) => setPendingQty(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmAdd()}
                className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center text-zinc-100"
              />
              <button
                onClick={() => setPendingQty((q) => String((Number(q) || 0) + 1))}
                className="h-8 w-8 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={confirmAdd}
              disabled={saving}
              className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:bg-zinc-700"
            >
              {saving ? "Saving..." : `Add ${pendingQty || 1} to Stock`}
            </button>
            <button
              onClick={cancelMatch}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
            >
              Not this card
            </button>
          </div>
        </div>
      )}

      {!pendingMatch && lastAdded && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-semibold text-green-400">✓ Added</p>
          <p className="mt-1 text-zinc-100">{lastAdded.qty}x {lastAdded.card.name}</p>
          <p className="text-xs text-zinc-500">{lastAdded.card.set} · {lastAdded.card.rarity}</p>
          <p className="mt-1 text-sm text-zinc-400">New stock: {lastAdded.newStock}</p>
        </div>
      )}
    </div>
  );
}
