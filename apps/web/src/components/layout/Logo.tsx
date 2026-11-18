import { Link } from "react-router";
import { cn } from "@/lib/utils";

export function Logo({
  to = "/",
  className,
  compact,
}: {
  to?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn("flex items-center gap-2 font-display font-extrabold leading-none", className)}
    >
      <span
        className="flex size-9 items-center justify-center rounded-xl border-2 border-foreground bg-primary text-lg text-primary-foreground shadow-pop-sm"
        aria-hidden="true"
      >
        ✚
      </span>
      <span className={cn("text-lg sm:text-xl", compact && "sr-only sm:not-sr-only")}>
        Africa Health Quest
      </span>
    </Link>
  );
}
