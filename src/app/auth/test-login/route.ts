import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Login por senha SOMENTE para testes automatizados (E2E).
 * Ativo apenas quando E2E_TEST_LOGIN=1 — nunca habilitar em produção.
 */
export async function POST(request: NextRequest) {
  if (process.env.E2E_TEST_LOGIN !== "1") return new NextResponse("Not found", { status: 404 });
  const { email, password } = (await request.json()) as { email: string; password: string };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });
  return NextResponse.json({ ok: true });
}
