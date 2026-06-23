"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/lib/types";

const SCAN_INTERVAL_MS = 1200;
const COOLDOWN_MS = 2500; // pause after a hit so the same card isn't double-counted

type Flash = "none" | "success" | "miss";

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
  const processingRef = useRef(false);
  const cooldownRef = useRef(false);

  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>("none");
  const [lastResult, setLastResult] = useState<{ card: Card; newStock: number } | null>(null);
  const [scanCount, setScanCount] = useState(0);

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

  const captureAndScan = useCallback(async () => {
    if (processingRef.current || cooldownRef.current) return;
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
        const card: Card = result.card;
        const newStock = card.stock + 1;
        await fetch("/api/admin/inventory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: card.id, price: card.price, stock: newStock }),
        });
        playDing();
        setFlash("success");
        setLastResult({ card, newStock });
        cooldownRef.current = true;
        setTimeout(() => {
          setFlash("none");
          cooldownRef.current = false;
        }, COOLDOWN_MS);
      }
    } catch {
      // Silently retry on the next tick — a single failed frame isn't worth surfacing.
    } finally {
      processingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!cameraOn) return;
    const id = setInterval(captureAndScan, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [cameraOn, captureAndScan]);

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-zinc-100">Scan Cards</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Point the camera at a card. It auto-scans every second or so — when it gets a hit, you&apos;ll
        hear a ding and see a green flash, and stock bumps up by 1. Swap to the next card and keep going.
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

      {cameraOn && (
        <button
          onClick={stopCamera}
          className="mb-4 w-full rounded-lg border border-zinc-700 py-2 text-sm text-zinc-300 hover:border-red-500 hover:text-red-400"
        >
          Stop Camera
        </button>
      )}

      <p className="mb-4 text-center text-xs text-zinc-500">{scanCount} frame(s) checked this session</p>

      {lastResult && (
        <div className="rounded-xl border border-green-700/50 bg-zinc-900 p-4">
          <p className="text-sm font-semibold text-green-400">✓ Matched</p>
          <p className="mt-1 text-zinc-100">{lastResult.card.name}</p>
          <p className="text-xs text-zinc-500">{lastResult.card.set} · {lastResult.card.rarity}</p>
          <p className="mt-1 text-sm text-zinc-400">New stock: {lastResult.newStock}</p>
        </div>
      )}
    </div>
  );
}
