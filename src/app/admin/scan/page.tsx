"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/lib/types";

const SCAN_INTERVAL_MS = 700;   // smaller cropped images → we can poll faster
const COOLDOWN_MS = 2000;       // pause after confirming so a card isn't double-counted
const CARD_ASPECT = 2.5 / 3.5;  // width / height of a standard card
const GUIDE_FRAC = 0.86;        // guide box height as a fraction of the visible square
const OUTPUT_H = 1000;          // px height of the cropped image we send (title stays legible)

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

// Quick check that the cropped frame actually has a card in it (not blank/dark/
// blurry-uniform), so we don't burn a round-trip on an empty frame.
function frameHasContent(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0, sumSq = 0, n = 0;
    for (let i = 0; i < data.length; i += 4 * 16) {
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += l; sumSq += l * l; n++;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return mean > 22 && variance > 120; // bright enough + has detail
  } catch {
    return true; // if we can't read pixels, don't block the scan
  }
}

export default function AdminScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const processingRef = useRef(false);
  const cooldownRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>("none");
  const [scanCount, setScanCount] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [pendingMatch, setPendingMatch] = useState<Card | null>(null);
  const [pendingQty, setPendingQty] = useState("1");
  const [saving, setSaving] = useState(false);
  const [lastAdded, setLastAdded] = useState<{ card: Card; qty: number; newStock: number } | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      // Best-effort continuous autofocus + torch capability detection.
      try {
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean };
        if (caps?.focusMode?.includes("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] } as unknown as MediaTrackConstraints);
        }
        setTorchSupported(!!caps?.torch);
      } catch { /* capability probing varies by device — ignore */ }
      setCameraOn(true);
    } catch {
      setCameraError("Couldn't access the camera. Check your browser's camera permission for this site.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    trackRef.current = null;
    setCameraOn(false);
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  async function toggleTorch() {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch { /* some devices reject torch mid-stream — ignore */ }
  }

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

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // The video is shown object-cover in a square, so only the center square is
    // visible. Crop the card-shaped guide region out of that square.
    const S = Math.min(vw, vh);
    const gh = S * GUIDE_FRAC;
    const gw = gh * CARD_ASPECT;
    const gx = (vw - gw) / 2;
    const gy = (vh - gh) / 2;

    canvas.height = OUTPUT_H;
    canvas.width = Math.round(OUTPUT_H * CARD_ASPECT);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, gx, gy, gw, gh, 0, 0, canvas.width, canvas.height);

    // Skip empty/dark frames — saves an API round-trip and keeps it snappy.
    if (!frameHasContent(ctx, canvas.width, canvas.height)) return;

    processingRef.current = true;
    setScanning(true);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
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
      setScanning(false);
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
        Line the card up inside the frame. On a match you&apos;ll hear a ding and the border flashes
        green — type how many copies you have and confirm, then it resumes scanning.
      </p>

      <div
        className={`relative mb-4 aspect-square overflow-hidden rounded-xl border-4 bg-zinc-900 transition-colors ${
          flash === "success" ? "border-green-500" : "border-zinc-800"
        }`}
      >
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {/* Card-shaped alignment guide */}
        {cameraOn && !pendingMatch && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="relative rounded-lg"
              style={{
                height: `${GUIDE_FRAC * 100}%`,
                aspectRatio: `${CARD_ASPECT}`,
                boxShadow: "0 0 0 100vmax rgba(0,0,0,0.45)",
                outline: "2px solid rgba(255,255,255,0.7)",
              }}
            >
              {/* corner ticks */}
              <span className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-tl-lg border-l-4 border-t-4 border-purple-400" />
              <span className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-tr-lg border-r-4 border-t-4 border-purple-400" />
              <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-lg border-b-4 border-l-4 border-purple-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-lg border-b-4 border-r-4 border-purple-400" />
              {scanning && (
                <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-purple-200">
                  scanning…
                </span>
              )}
            </div>
          </div>
        )}

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
        <div className="mb-4 flex gap-2">
          {torchSupported && (
            <button
              onClick={toggleTorch}
              className={`flex-1 rounded-lg border py-2 text-sm ${
                torchOn ? "border-yellow-500 text-yellow-300" : "border-zinc-700 text-zinc-300 hover:border-purple-500"
              }`}
            >
              {torchOn ? "🔦 Light On" : "🔦 Light Off"}
            </button>
          )}
          <button
            onClick={stopCamera}
            className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
          >
            Stop Camera
          </button>
        </div>
      )}

      <p className="mb-4 text-center text-xs text-zinc-500">{scanCount} card(s) read this session</p>

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
