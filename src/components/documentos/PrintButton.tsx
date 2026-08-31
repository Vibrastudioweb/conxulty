"use client";

import { Button } from "@/components/ui/Button";

/**
 * Único componente cliente del proyecto: window.print() no existe del lado
 * servidor. Todo lo demás en esta pantalla sigue siendo Server Component.
 */
export function PrintButton() {
  return (
    <Button type="button" fullWidth onClick={() => window.print()}>
      Imprimir
    </Button>
  );
}
