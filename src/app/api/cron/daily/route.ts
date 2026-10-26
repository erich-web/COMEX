import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient, hasServiceRole } from "@/lib/supabase/admin";
import { runDailyJobs } from "@/lib/jobs";

/**
 * Rotina diária (Vercel Cron, ver vercel.json — 11:00 UTC = 08:00 em São Paulo).
 * A Vercel envia "Authorization: Bearer <CRON_SECRET>" quando a variável CRON_SECRET existe no projeto.
 * Chamadas sem o segredo são recusadas. Em desenvolvimento, aceita sem segredo quando CRON_SECRET não está definido.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  if (secret) {
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "não autorizado" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado no servidor." }, { status: 503 });
  }
  if (!hasServiceRole()) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY não configurada — a rotina diária precisa dela." }, { status: 503 });

  const force = req.nextUrl.searchParams.get("force"); // digest | reminders | analysis (para testes)
  try {
    const report = await runDailyJobs(createServiceClient(), {
      kind: "daily",
      force: force ? { digest: force.includes("digest"), reminders: force.includes("reminders"), analysis: force.includes("analysis") } : undefined,
    });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
