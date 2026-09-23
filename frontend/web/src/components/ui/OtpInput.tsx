"use client";

import { useRef } from "react";

export default function OtpInput({ length = 6, value, onChange }: { length?: number; value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").split("");

  function setDigit(i: number, d: string) {
    const clean = d.replace(/[^0-9]/g, "");
    const next = value.split("");
    next[i] = clean.slice(-1) || "";
    const joined = next.join("").slice(0, length);
    onChange(joined);
    if (clean && i < length - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, length);
    if (text) {
      e.preventDefault();
      onChange(text);
      refs.current[Math.min(text.length, length - 1)]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d.trim()}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i].trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          inputMode="numeric"
          maxLength={1}
          className="h-14 w-12 rounded-input border-[1.5px] border-gray-300 text-center text-xl font-bold text-gray-900 outline-none focus:border-accent"
        />
      ))}
    </div>
  );
}
