"use client";

import { useEffect, useState } from "react";

interface Notice {
  active: boolean;
  message: string;
  resumeDate: string | null;
}

// Shown site-wide when the owner turns on a shipping-delay notice (e.g. out of
// town). Fetches the public notice on mount; renders nothing when inactive.
export default function ShippingNoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    fetch("/api/shipping-notice")
      .then((r) => r.json())
      .then((d) => setNotice(d))
      .catch(() => {});
  }, []);

  if (!notice?.active) return null;

  const resume = notice.resumeDate
    ? new Date(notice.resumeDate).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
    : null;

  return (
    <div className="border-b border-amber-700/50 bg-amber-950/60 px-4 py-2.5 text-center text-sm text-amber-200 print:hidden">
      <span className="mr-1">🚚</span>
      <span className="font-medium">{notice.message || "Shipping is temporarily delayed."}</span>
      {resume && <span className="text-amber-300/80"> Orders ship again around {resume}.</span>}
    </div>
  );
}
