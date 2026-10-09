'use client';

import { useState } from 'react';

/** Matnni buferga nusxalash (kuzatuv havolasi, kod) */
export function CopyButton({ text, label = 'Nusxalash' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      window.prompt('Nusxalang:', text);
    }
  }
  return <button type="button" onClick={copy} className="btn-ghost px-3 py-1 text-xs">{done ? 'Nusxalandi ✓' : label}</button>;
}
