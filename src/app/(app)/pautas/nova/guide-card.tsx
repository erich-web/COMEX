"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { GUIDE_RULES } from "@/lib/guide";

const KEY = "comex:guide:collapsed";

/** Card "Como funciona" no topo do envio de pautas — aberto na primeira visita, recolhível depois. */
export function GuideCard() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(KEY) === "1") setOpen(false);
    } catch {}
  }, []);
  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem(KEY, o ? "1" : "0");
      } catch {}
      return !o;
    });
  }
  return (
    <div className="rounded-[14px] border border-line bg-surface">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <BookOpen className="size-4 text-primary" />
        <span className="flex-1 text-[14px] font-semibold">Como enviar uma boa pauta</span>
        {open ? <ChevronUp className="size-4 text-mute" /> : <ChevronDown className="size-4 text-mute" />}
      </button>
      {open ? (
        <div className="border-t border-line px-4 pb-4 pt-3 fade-in">
          <ol className="space-y-2">
            {GUIDE_RULES.slice(0, 5).map((r, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-snug">
                <span className="w-4 shrink-0 font-bold text-primary">{i + 1}.</span>
                <span>
                  <strong>{r.title}</strong> {r.text}
                </span>
              </li>
            ))}
          </ol>
          <Link href="/como-funciona" className="mt-3 inline-block text-[13px] font-semibold text-primary">
            Ver a orientação completa, incluindo a prestação de contas →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
