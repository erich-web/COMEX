import { redirect } from "next/navigation";

/** A organização da terça vive em /admin. */
export default async function AdminPautasRedirect({ searchParams }: PageProps<"/admin/pautas">) {
  const sp = await searchParams;
  const r = typeof sp.reuniao === "string" ? `?reuniao=${sp.reuniao}` : "";
  redirect(`/admin${r}`);
}
