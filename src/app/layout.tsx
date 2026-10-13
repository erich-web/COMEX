import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toast";

// Fontes do brandbook RPE auto-hospedadas (src/fonts, OFL) — sem dependência do Google Fonts.
const anton = localFont({
  src: [
    { path: "../fonts/anton-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/anton-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-anton",
  display: "swap",
});
const dmSans = localFont({
  src: [
    { path: "../fonts/dm-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-sans-latin-ext-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/dm-sans-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/dm-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/dm-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/dm-sans-latin-ext-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/dm-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});
const spectral = localFont({
  src: [
    { path: "../fonts/spectral-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "../fonts/spectral-latin-300-italic.woff2", weight: "300", style: "italic" },
    { path: "../fonts/spectral-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/spectral-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/spectral-latin-ext-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../fonts/spectral-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/spectral-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "../fonts/spectral-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/spectral-latin-ext-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/spectral-latin-600-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-spectral",
  display: "swap",
});

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
