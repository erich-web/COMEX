import type { DbClient } from "@/lib/supabase/admin";

export type NotificationSettings = { task_reminder_every_days: number; digest_day_before: boolean; send_hour: number };

export type AppSettings = {
  calendar: { weekday: number; time: string; duration_minutes: number };
  agendaDeadline: { weekday: number; time: string; label: string };
  prepDeadline: { weekday: number; time: string; label: string };
  goal2030: { year: number; revenue_target: number; label?: string };
  defaultBlocks: { order: number; kind: string; title: string; minutes: number }[];
  notifications: NotificationSettings;
};

export const DEFAULT_NOTIFICATIONS: NotificationSettings = { task_reminder_every_days: 3, digest_day_before: true, send_hour: 8 };

/** Lê app_settings com qualquer cliente (usuário ou serviço) e aplica os padrões. */
export async function readSettings(supabase: DbClient): Promise<AppSettings> {
  const { data } = await supabase.from("app_settings").select("key,value");
  const map: Record<string, unknown> = {};
  (data ?? []).forEach((r) => (map[r.key] = r.value));
  const n = (map.notifications ?? {}) as Partial<NotificationSettings>;
  return {
    calendar: (map.calendar ?? { weekday: 2, time: "09:00", duration_minutes: 180 }) as AppSettings["calendar"],
    agendaDeadline: (map.agenda_deadline ?? { weekday: 5, time: "17:00", label: "Sexta-feira até 17h" }) as AppSettings["agendaDeadline"],
    prepDeadline: (map.prep_deadline ?? { weekday: 1, time: "18:00", label: "Segunda-feira até 18h" }) as AppSettings["prepDeadline"],
    goal2030: (map.goal_2030 ?? { year: 2030, revenue_target: 200000000 }) as AppSettings["goal2030"],
    defaultBlocks: (map.default_blocks ?? []) as AppSettings["defaultBlocks"],
    notifications: {
      task_reminder_every_days: Math.max(1, Number(n.task_reminder_every_days ?? DEFAULT_NOTIFICATIONS.task_reminder_every_days) || 3),
      digest_day_before: n.digest_day_before ?? DEFAULT_NOTIFICATIONS.digest_day_before,
      send_hour: Number(n.send_hour ?? DEFAULT_NOTIFICATIONS.send_hour) || 8,
    },
  };
}
