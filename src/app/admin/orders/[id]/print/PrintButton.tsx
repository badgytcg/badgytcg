"use client";

import { useRef } from "react";

// Print the receipt by cloning it into a disposable hidden iframe and printing
// THAT, instead of calling window.print() on the page. Repeated calls to
// window.print() on the same document can deadlock Chrome (the print state from
// the first call isn't released, so the page hangs until a refresh). A fresh
// iframe per print sidesteps that entirely.
export default function PrintButton() {
  const busyRef = useRef(false);

  function printReceipt() {
    if (busyRef.current) return;
    const paper = document.getElementById("receipt-paper");
    if (!paper) { window.print(); return; }
    busyRef.current = true;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) { iframe.remove(); busyRef.current = false; window.print(); return; }

    doc.open();
    doc.write("<!DOCTYPE html><html><head><title>Receipt</title></head><body></body></html>");
    // Carry over the page's stylesheets so the receipt keeps its styling.
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
      doc.head.appendChild(node.cloneNode(true));
    });
    doc.body.appendChild(paper.cloneNode(true));
    doc.close();

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      iframe.remove();
      busyRef.current = false;
    };
    win.onafterprint = cleanup;
    // Give cloned stylesheets a moment to apply before printing, and guarantee
    // cleanup even if onafterprint never fires (some browsers skip it).
    setTimeout(() => {
      try { win.focus(); win.print(); } catch { /* ignore */ }
      setTimeout(cleanup, 60_000);
    }, 300);
  }

  return (
    <button
      onClick={printReceipt}
      className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-500"
    >
      Print receipt
    </button>
  );
}
