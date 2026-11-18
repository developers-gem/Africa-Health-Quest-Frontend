import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

const tones = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  card: "bg-card text-foreground",
} as const;

/** The big coloured menu tiles of the prototype home screen. */
export function ActionTile({
  to,
  icon,
  title,
  description,
  tone = "card",
  badge,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  description: string;
  tone?: keyof typeof tones;
  badge?: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "pressable group flex items-center gap-4 rounded-2xl border-2 border-foreground p-5 shadow-pop transition-transform hover:-translate-y-0.5",
        tones[tone],
      )}
    >
      <span className="text-3xl" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-display text-lg font-extrabold">
          {title} {badge}
        </span>
        <span className="block text-sm opacity-90">{description}</span>
      </span>
    </Link>
  );
}
