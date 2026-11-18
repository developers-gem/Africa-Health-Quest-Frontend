import { Link } from "react-router";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/format";
import type { Progress as ProgressT } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function HpPill({ hp, className }: { hp: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground tabular-nums",
        className,
      )}
      aria-label={`${hp} Health Points`}
      data-testid="hp-pill"
    >
      <span aria-hidden="true">❤️</span>
      {formatNumber(hp)}
    </span>
  );
}

export function FundingPill({ funding, className }: { funding: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 border-foreground bg-secondary px-3 py-1 text-sm font-extrabold text-secondary-foreground tabular-nums",
        className,
      )}
      aria-label={`${funding} cedis of funding`}
      data-testid="funding-pill"
    >
      ₵{formatNumber(funding)}
    </span>
  );
}

/** The prototype's "Village Clinic — 150 HP to Community Hospital" bar. */
export function TierProgress({
  progress,
  guest,
  className,
}: {
  progress: ProgressT;
  guest?: boolean;
  className?: string;
}) {
  const { tier, nextTier, hp, hpToNextTier } = progress;
  const pct = nextTier
    ? Math.round(
        ((hp - tier.hpRequired) / Math.max(1, nextTier.hpRequired - tier.hpRequired)) * 100,
      )
    : 100;
  return (
    <div
      className={cn("rounded-2xl border-2 border-foreground bg-card p-4", className)}
      data-testid="tier-progress"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
        <span>
          <span aria-hidden="true">{tier.icon}</span> {tier.name}
        </span>
        <span className="text-muted-foreground">
          {nextTier ? `${hpToNextTier} HP to ${nextTier.name}` : "Top hospital level reached"}
        </span>
      </div>
      <Progress value={pct} className="mt-2" aria-label="Progress to the next hospital level" />
      {guest && (
        <Link
          to="/register?upgrade=1"
          className="mt-2 inline-block text-sm font-bold text-primary underline underline-offset-2"
        >
          Create an account to save progress across devices
        </Link>
      )}
    </div>
  );
}
