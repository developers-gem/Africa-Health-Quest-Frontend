import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

/** A date-range filter shared by analytics, reports and AI usage. */
export function useRange(initial = "30") {
  const [days, setDays] = useState(initial);
  const range = useMemo(() => {
    const to = new Date();
    return {
      from: new Date(to.getTime() - Number(days) * 86_400_000).toISOString(),
      to: to.toISOString(),
    };
    // Recompute only when the preset changes so query keys stay stable.
  }, [days]);
  const control = (
    <Select value={days} onValueChange={setDays}>
      <SelectTrigger className="w-44" aria-label="Date range">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {RANGES.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
  return { days, range, control };
}
