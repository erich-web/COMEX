"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead, updateMyProfile } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, Input, Label } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";

export function ProfileForm({ profile }: { profile: { full_name: string; short_name: string; phone: string; email: string } }) {
  const router = useRouter();
  const [f, setF] = useState(profile);
  const [pending, start] = useTransition();
  return (
    <Card className="space-y-3">
      <div>
        <Label>E-mail</Label>
        <Input value={f.email} disabled />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Nome completo</Label>
          <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div>
          <Label>Como quer ser chamado</Label>
          <Input value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} />
        </div>
        <div>
          <Label>WhatsApp</Label>
          <Input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+55 11 9…" />
        </div>
      </div>
      <Button
        variant="primary"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await updateMyProfile(f);
            if (r.ok) {
              toast(r.message ?? "Salvo");
              router.refresh();
            } else toast.error(r.error);
          })
        }
      >
        Salvar
      </Button>
    </Card>
  );
}

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2"
      onClick={() =>
        start(async () => {
          await markNotificationsRead();
          router.refresh();
        })
      }
    >
      Marcar todas como lidas
    </button>
  );
}
