import { cn } from "@/lib/utils";

export function KenteStrip({ thin, className }: { thin?: boolean; className?: string }) {
  return (
    <div className={cn(thin ? "kente-strip-thin" : "kente-strip", className)} aria-hidden="true" />
  );
}
