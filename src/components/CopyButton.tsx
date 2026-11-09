"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older in-app browsers: fall back to a hidden textarea.
      const t = document.createElement("textarea");
      t.value = text;
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 rounded-full border border-ink/15 bg-card px-3.5 py-1.5 text-sm font-medium transition hover:border-ink/40 ${className}`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
