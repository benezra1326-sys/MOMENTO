"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown, X } from "lucide-react";

const KEY = "upclose_nudge_black";

/** Bandeau discret vers Upclose Black dans le fil, masquable pendant 7 jours. */
export function PremiumNudge({ tier }: { tier: "free" | "plus" }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(KEY) || 0);
      setShow(Date.now() > until);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  return (
    <div className="relative flex items-center gap-3 rounded-3xl border border-[#d4af6a]/40 bg-[radial-gradient(120%_120%_at_100%_0%,#3a2f17_0%,#000_60%)] p-4 pr-11 text-white">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d4af6a] text-black"><Crown size={18} aria-hidden /></span>
      <Link href="/premium" className="min-w-0 flex-1">
        <span className="block font-semibold text-[#e2c486]">{tier === "plus" ? "Passe à Upclose Black" : "Découvre Upclose Black"}</span>
        <span className="block text-sm text-white/75">Qui a vu ton profil, personnes pour toi, Moments réservés, thème noir et or.</span>
      </Link>
      <button
        type="button"
        aria-label="Masquer"
        onClick={() => {
          try {
            localStorage.setItem(KEY, String(Date.now() + 7 * 86400_000));
          } catch {}
          setShow(false);
        }}
        className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
      >
        <X size={16} />
      </button>
    </div>
  );
}
