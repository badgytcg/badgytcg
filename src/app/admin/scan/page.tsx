"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/lib/types";

const SCAN_INTERVAL_MS = 700;
const COOLDOWN_MS = 1800;        // pause after a hit so one card isn't counted twice
const CARD_ASPECT = 2.5 / 3.5;
const GUIDE_FRAC = 0.86;
const OUTPUT_H = 1000;
const SESSION_KEY = "badgy-scan-session";

type Flash = "none" | "success";
interface SessionLine {
  card: Card;
  qty: number;
}

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
  } catch { /* ignore */ }
}

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
    return mean > 22 && variance > 120;
  } catch {
    return true;
  }
}

export default function AdminScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const processingRef = useRef(false);
  const cooldownRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>("none");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const [session, setSession] = useState<SessionLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  // Load + persist the session so scanning survives reloads until committed.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
  }, [session, hydrated]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser doesn't support camera access. Try Chrome, Edge, or Safari.");
      return;
    }
    if (!window.isSecureContext) {
      setCameraError("Camera needs a secure (https) connection. Open the site at https://badgytcg.com and try again.");
      return;
    }
    const attempts: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { video: { facingMode: "environment" } },
      { video: true },
    ];
    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    for (const constraints of attempts) {
      try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; }
      catch (err) {
        lastErr = err;
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError" || name === "NotFoundError" || name === "NotReadableError") break;
      }
    }
    if (!stream) {
      const name = lastErr instanceof DOMException ? lastErr.name : "";
      const msg = lastErr instanceof Error ? lastErr.message : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera access was denied. On a phone, tap Start Camera and hit Allow on the popup (scanning works best on a phone). On desktop, click the camera icon in the address bar → Allow, then reload. Embedded/in-app browsers often block the camera — open badgytcg.com directly in Chrome or Safari."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : name === "NotReadableError"
              ? "The camera is being used by another app or tab. Close anything else using it, then try again."
              : `Couldn't start the camera${name ? ` (${name})` : ""}. ${msg}`.trim()
      );
      return;
    }
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      try {
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[]; torch?: boolean };
        if (caps?.focusMode?.includes("continuous")) {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] } as unknown as MediaTrackConstraints);
        }
        setTorchSupported(!!caps?.torch);
      } catch { /* ignore */ }
      setCameraOn(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setCameraError(`Camera opened but couldn't display the video. ${msg}`.trim());
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
    } catch { /* ignore */ }
  }

  useEffect(() => () => stopCamera(), [stopCamera]);

  function addScannedCard(card: Card) {
    setSession((prev) => {
      const idx = prev.findIndex((l) => l.card.id === card.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        setLastScan(`＋ ${card.name} (×${next[idx].qty})`);
        return next;
      }
      setLastScan(`＋ ${card.name}`);
      return [{ card, qty: 1 }, ...prev];
    });
  }

  const captureAndScan = useCallback(async () => {
    if (processingRef.current || cooldownRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    const vw = video.videoWidth, vh = video.videoHeight;
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
    if (!frameHasContent(ctx, canvas.width, canvas.height)) return;

    processingRef.current = true;
    setScanning(true);
    const base64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];

    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: "image/jpeg" }),
      });
      const result = await res.json();
      if (res.ok && result.card) {
        playDing();
        setFlash("success");
        addScannedCard(result.card);
        // Brief cooldown so the same physical card isn't counted repeatedly.
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; setFlash("none"); }, COOLDOWN_MS);
      }
    } catch {
      /* ignore a bad frame */
    } finally {
      processingRef.current = false;
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    const id = setInterval(captureAndScan, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cameraOn, captureAndScan]);

  function setQty(cardId: string, qty: number) {
    setSession((prev) =>
      qty <= 0
        ? prev.filter((l) => l.card.id !== cardId)
        : prev.map((l) => (l.card.id === cardId ? { ...l, qty } : l))
    );
  }

  const titleCount = session.length;
  const cardCount = session.reduce((n, l) => n + l.qty, 0);

  async function commitSession() {
    if (session.length === 0) return;
    setCommitting(true);
    setCommitResult(null);
    try {
      const res = await fetch("/api/admin/inventory/scan-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: session.map((l) => ({ cardId: l.card.id, qty: l.qty })) }),
      });
      const data = await res.json();
      if (res.ok) {
        setCommitResult(`✓ Added ${cardCount} card(s) across ${data.updated.length} title(s) to inventory.`);
        setSession([]);
      } else {
        setCommitResult(`✗ ${data.error ?? "Couldn't add to inventory."}`);
      }
    } catch {
      setCommitResult("✗ Couldn't reach the server. Try again.");
    }
    setCommitting(false);
  }

  function endSession() {
    if (session.length > 0 && !confirm(`Discard ${cardCount} scanned card(s) without adding to inventory?`)) return;
    setSession([]);
    setCommitResult(null);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Scan Cards</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Line each card up in the frame — a ding + green flash means it was added to this session. Keep
        scanning; nothing hits your inventory until you tap <span className="text-zinc-200">Add all to inventory</span>.
      </p>

      <div
        className={`relative mb-3 aspect-square overflow-hidden rounded-xl border-4 bg-zinc-900 transition-colors ${
          flash === "success" ? "border-green-500" : "border-zinc-800"
        }`}
      >
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {cameraOn && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="relative rounded-lg"
              style={{ height: `${GUIDE_FRAC * 100}%`, aspectRatio: `${CARD_ASPECT}`, boxShadow: "0 0 0 100vmax rgba(0,0,0,0.45)", outline: "2px solid rgba(255,255,255,0.7)" }}
            >
              <span className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-tl-lg border-l-4 border-t-4 border-purple-400" />
              <span className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-tr-lg border-r-4 border-t-4 border-purple-400" />
              <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 rounded-bl-lg border-b-4 border-l-4 border-purple-400" />
              <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-br-lg border-b-4 border-r-4 border-purple-400" />
              {scanning && (
                <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-purple-200">scanning…</span>
              )}
            </div>
          </div>
        )}

        {flash === "success" && lastScan && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600/90 px-4 py-1.5 text-sm font-medium text-white">
            {lastScan}
          </div>
        )}

        {!cameraOn && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <button onClick={startCamera} className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500">
              Start Camera
            </button>
          </div>
        )}
      </div>

      {cameraError && <p className="mb-4 text-sm text-red-400">{cameraError}</p>}

      {cameraOn && (
        <div className="mb-4 flex gap-2">
          {torchSupported && (
            <button onClick={toggleTorch} className={`flex-1 rounded-lg border py-2 text-sm ${torchOn ? "border-yellow-500 text-yellow-300" : "border-zinc-700 text-zinc-300 hover:border-purple-500"}`}>
              {torchOn ? "🔦 Light On" : "🔦 Light Off"}
            </button>
          )}
          <button onClick={stopCamera} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400">
            Pause Camera
          </button>
        </div>
      )}

      {commitResult && (
        <p className={`mb-4 text-sm ${commitResult.startsWith("✓") ? "text-green-400" : "text-red-400"}`}>{commitResult}</p>
      )}

      {/* Session list */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            This Session
          </h2>
          <span className="text-xs text-zinc-500">{titleCount} title(s) · {cardCount} card(s)</span>
        </div>

        {session.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing scanned yet — start the camera and scan a card.</p>
        ) : (
          <>
            <ul className="mb-4 max-h-80 space-y-2 overflow-y-auto">
              {session.map((line) => (
                <li key={line.card.id} className="flex items-center gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-zinc-100">{line.card.name}</p>
                    <p className="truncate text-xs text-zinc-500">{line.card.set} · {line.card.rarity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(line.card.id, line.qty - 1)} className="h-7 w-7 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500">−</button>
                    <input
                      type="number"
                      min={0}
                      value={line.qty}
                      onChange={(e) => setQty(line.card.id, Math.max(0, Math.round(Number(e.target.value)) || 0))}
                      className="w-12 rounded border border-zinc-700 bg-zinc-950 px-1 py-1 text-center text-zinc-100"
                    />
                    <button onClick={() => setQty(line.card.id, line.qty + 1)} className="h-7 w-7 rounded border border-zinc-700 text-zinc-300 hover:border-purple-500">+</button>
                  </div>
                  <button onClick={() => setQty(line.card.id, 0)} title="Remove" className="ml-1 text-zinc-600 hover:text-red-400">✕</button>
                </li>
              ))}
            </ul>

            <div className="flex gap-2">
              <button
                onClick={commitSession}
                disabled={committing}
                className="flex-1 rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:bg-zinc-700"
              >
                {committing ? "Adding…" : `Add all to inventory (${cardCount})`}
              </button>
              <button
                onClick={endSession}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
              >
                End session
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
