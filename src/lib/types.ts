import type { Database } from "@/lib/supabase/database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];

export type AgendaCategory = Enums<"agenda_category">;
export type AgendaStatus = Enums<"agenda_status">;
export type TaskStatus = Enums<"task_status">;
export type TaskPriority = Enums<"task_priority">;
export type Urgency = Enums<"urgency_level">;
export type MeetingStatus = Enums<"meeting_status">;
export type GrowthStatus = Enums<"growth_status">;
export type BlockKind = Enums<"block_kind">;

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
