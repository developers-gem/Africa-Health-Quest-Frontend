import { CheckCircle2, Lock } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import type { MissionSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function MissionCard({
  m,
  mode = "story",
  to,
}: {
  m: MissionSummary;
  mode?: "story" | "practice";
  to?: string;
}) {
  const locked = mode === "story" && m.locked;
  return (
    <Link
      to={to ?? `/play/missions/${m.key}${mode === "practice" ? "?mode=practice" : ""}`}
      className={cn(
        "pressable flex items-start gap-3 rounded-2xl border-2 border-foreground bg-card p-4 shadow-pop-sm transition-transform hover:-translate-y-0.5",
        locked && "bg-muted/70",
      )}
      data-testid={`mission-${m.key}`}
      aria-label={`${m.title}${locked ? " (locked)" : ""}`}
    >
      <span className={cn("text-3xl", locked && "grayscale")} aria-hidden="true">
        {m.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-extrabold leading-tight">{m.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="muted">{m.stepCount} steps</Badge>
          <Badge variant="muted">{m.countryCode}</Badge>
          {m.progress?.passed && (
            <Badge variant="success">
              <CheckCircle2 className="size-3" /> Saved · best {m.progress.bestScore}/{m.maxScore}
            </Badge>
          )}
          {locked && (
            <Badge variant="outline">
              <Lock className="size-3" />{" "}
              {m.lockReason === "tier" ? "Higher hospital level needed" : "Country locked"}
            </Badge>
          )}
        </span>
      </span>
    </Link>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn("mb-3 mt-8 text-xl font-extrabold first:mt-0", className)}>{children}</h2>
  );
}
