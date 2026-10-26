import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type DbClient = SupabaseClient<Database>;

/**
 * Cliente com a chave service_role — ignora RLS. Só para rotinas do servidor sem usuário
 * (cron diário, e-mails). Nunca importe este módulo em componentes client.
 */
export function hasServiceRole() {
  return !!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
}

export function createServiceClient(): DbClient {
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor (necessária para as rotinas automáticas).");
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
