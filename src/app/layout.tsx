import type { Metadata, Viewport } from "next";
import { Anton, DM_Sans, Spectral } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });
const spectral = Spectral({ weight: ["300", "400", "500", "600"], style: ["normal", "italic"], subsets: ["latin"], variable: "--font-spectral", display: "swap" });

export const metadata: Metadata = {
  title: { default: "RPE COMEX", template: "%s · RPE COMEX" },
  description: "Comitê Executivo do Grupo RPE — pautas, tarefas, indicadores e a rota para os R$ 200 milhões.",
  applicationName: "RPE COMEX",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RPE COMEX" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f0f0f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${anton.variable} ${dmSans.variable} ${spectral.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
