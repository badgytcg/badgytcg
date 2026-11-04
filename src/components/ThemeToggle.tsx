"use client";

import { useEffect, useRef, useState } from "react";

type Choice = "light" | "dark" | "system";

function resolve(choice: Choice): "light" | "dark" {
  if (choice === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return choice;
}

function apply(choice: Choice) {
  document.documentElement.setAttribute("data-theme", resolve(choice));
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = (localStorage.getItem("theme") as Choice) || "system";
      setChoice(saved);
    } catch { /* private mode */ }
  }, []);

  // Follow the OS while on "system".
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  // Close the menu on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(next: Choice) {
    setChoice(next);
    try { localStorage.setItem("theme", next); } catch { /* private mode */ }
    apply(next);
    setOpen(false);
  }

  // Render a stable icon until mounted to avoid hydration mismatch.
  const resolved = mounted ? resolve(choice) : "dark";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-purple-500/60 hover:text-zinc-200"
      >
        {resolved === "dark" ? <MoonIcon /> : <SunIcon />}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 py-1 shadow-xl">
          {(["light", "dark", "system"] as Choice[]).map((opt) => (
            <button
              key={opt}
              role="menuitemradio"
              aria-checked={choice === opt}
              onClick={() => pick(opt)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm capitalize ${choice === opt ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"}`}
            >
              {opt === "light" ? <SunIcon /> : opt === "dark" ? <MoonIcon /> : <SystemIcon />}
              {opt}
              {choice === opt && <span className="ml-auto text-purple-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
function SystemIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" />
    </svg>
  );
}
