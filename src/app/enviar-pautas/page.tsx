import { redirect } from "next/navigation";

/** Link permanente e compartilhável (WhatsApp/e-mail/favoritos): leva o usuário autenticado direto ao formulário. */
export default function EnviarPautasRedirect() {
  redirect("/pautas/nova");
}
