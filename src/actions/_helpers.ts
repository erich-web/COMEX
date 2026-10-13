import { z } from "zod";
import type { ActionResult } from "@/lib/types";

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function fromZod(err: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(err);
  const fieldErrors: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(flat.fieldErrors)) if (v) fieldErrors[k] = v as string[];
  return { ok: false, error: "Revise os campos destacados.", fieldErrors };
}

export const optionalText = (max = 4000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const optionalUuid = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null));

export const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null));

export const optionalNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

export function msg(e: unknown, fallback = "Não foi possível concluir. Tente novamente.") {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const m = (e as { message: string }).message;
    if (/not allowed|permission|policy|row-level/i.test(m)) return "Você não tem permissão para esta ação.";
    return m;
  }
  return fallback;
}
