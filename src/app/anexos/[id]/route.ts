import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre um anexo de pauta: a RLS decide quem pode ver; o arquivo sai por URL assinada de curta duração. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: att } = await supabase.from("agenda_attachments").select("storage_path,url,name").eq("id", id).maybeSingle();
  if (!att) return new NextResponse("Anexo não encontrado ou sem permissão.", { status: 404 });
  if (att.url && !att.storage_path) return NextResponse.redirect(att.url);
  const { data, error } = await supabase.storage.from("comex").createSignedUrl(att.storage_path!, 60 * 30);
  if (error || !data) return new NextResponse("Não foi possível abrir o anexo.", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
