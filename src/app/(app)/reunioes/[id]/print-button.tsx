"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Download em PDF via diálogo de impressão do navegador (Salvar como PDF). */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Printer /> PDF
    </Button>
  );
}
