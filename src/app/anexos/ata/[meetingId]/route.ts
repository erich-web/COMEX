import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre o arquivo original da ata (PDF/Word) — a RLS da ata decide quem vê; URL assinada de curta duração. */
export async function GET(_req: Request, { params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  const supabase = await createClient();
  const { data: mm } = await supabase.from("meeting_minutes").select("file_path,drive_url").eq("meeting_id", meetingId).maybeSingle();
  if (!mm) return new NextResponse("Ata não encontrada ou sem permissão.", { status: 404 });
  if (!mm.file_path) {
    if (mm.drive_url) return NextResponse.redirect(mm.drive_url);
    return new NextResponse("Esta ata não tem arquivo anexado.", { status: 404 });
  }
  const { data, error } = await supabase.storage.from("comex").createSignedUrl(mm.file_path, 60 * 30);
  if (error || !data) return new NextResponse("Não foi possível abrir o arquivo.", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
