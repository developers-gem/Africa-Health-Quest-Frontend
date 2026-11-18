import { Lock } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { mediaUrl } from "@/lib/api/client";
import type { Country, MissionSummary } from "@/lib/api/types";
import { titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";

export const REGION_LABELS: Record<string, string> = {
  northern: "North Africa",
  western: "West Africa",
  central: "Central Africa",
  eastern: "East Africa",
  southern: "Southern Africa",
};

export function CountryFlag({
  country,
  className,
}: {
  country: Pick<Country, "flagEmoji" | "flagUrl" | "name">;
  className?: string;
}) {
  const url = mediaUrl(country.flagUrl);
  return url ? (
    <img
      src={url}
      alt=""
      className={cn("h-7 w-10 rounded border border-foreground/30 object-cover", className)}
    />
  ) : (
    <span className={cn("text-3xl leading-none", className)} aria-hidden="true">
      {country.flagEmoji}
    </span>
  );
}

export function CountryCard({
  country,
  to,
  showLock,
}: {
  country: Country;
  to: string;
  showLock?: boolean;
}) {
  const locked = showLock && country.unlocked === false;
  const soon = country.status === "coming_soon";
  return (
    <Link
      to={to}
      className={cn(
        "pressable flex h-full flex-col gap-2 rounded-2xl border-2 border-foreground bg-card p-4 shadow-pop-sm hover:-translate-y-0.5",
        (locked || soon) && "bg-muted/60",
      )}
      data-testid={`country-${country.code}`}
    >
      <div className="flex items-center justify-between gap-2">
        <CountryFlag country={country} />
        {soon ? (
          <Badge variant="muted">Coming soon</Badge>
        ) : locked ? (
          <Badge variant="outline">
            <Lock className="size-3" /> {country.unlock.minHp} HP
          </Badge>
        ) : country.unlocked ? (
          <Badge variant="success">Unlocked</Badge>
        ) : null}
      </div>
      <div className="font-display text-lg font-extrabold leading-tight">{country.name}</div>
      <p className="line-clamp-2 text-sm text-muted-foreground">
        {country.focus || REGION_LABELS[country.region]}
      </p>
      <div className="mt-auto text-xs font-bold text-muted-foreground">
        {country.missionCount} {country.missionCount === 1 ? "case" : "cases"}
      </div>
    </Link>
  );
}

export function TopicChips({ topics }: { topics: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {topics.map((t) => (
        <Badge key={t} variant="outline">
          {titleCase(t)}
        </Badge>
      ))}
    </div>
  );
}

export function MissionTitle({ m }: { m: Pick<MissionSummary, "icon" | "title"> }) {
  return (
    <span className="flex items-center gap-2">
      <span className="text-2xl" aria-hidden="true">
        {m.icon}
      </span>
      <span className="font-display font-extrabold">{m.title}</span>
    </span>
  );
}
