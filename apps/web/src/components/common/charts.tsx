import { useState, type ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Single-series charts (one validated hue, no legend — the title names the series). Every chart has a
 * hover/focus tooltip and a table view so values are never colour- or hover-only.
 */
export type Datum = { label: string; value: number; display?: string; note?: ReactNode };

function ChartFrame({
  title,
  description,
  data,
  valueHeader,
  children,
}: {
  title: string;
  description?: string;
  data: Datum[];
  valueHeader: string;
  children: ReactNode;
}) {
  const [table, setTable] = useState(false);
  return (
    <figure className="rounded-2xl border-2 border-foreground/15 bg-card p-4">
      <figcaption className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-display font-extrabold">{title}</div>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
        </div>
        <button
          className="text-xs font-bold text-primary underline underline-offset-2"
          onClick={() => setTable(!table)}
        >
          {table ? "Show chart" : "Show table"}
        </button>
      </figcaption>
      {table ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">{valueHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.label}>
                <TableCell>{d.label}</TableCell>
                <TableCell className="text-right tabular-nums">{d.display ?? d.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        children
      )}
    </figure>
  );
}

/** Horizontal bars: comparing magnitudes across named items. Value at the bar tip. */
export function BarList({
  title,
  description,
  data,
  max,
  valueHeader = "Value",
  empty = "No data for this period.",
}: {
  title: string;
  description?: string;
  data: Datum[];
  max?: number;
  valueHeader?: string;
  empty?: string;
}) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ChartFrame title={title} description={description} data={data} valueHeader={valueHeader}>
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2.5" role="list">
          {data.map((d) => (
            <li
              key={d.label}
              className="group relative grid grid-cols-[minmax(6rem,14rem)_1fr] items-center gap-3 text-sm"
              tabIndex={0}
              aria-label={`${d.label}: ${d.display ?? d.value}`}
            >
              <span className="truncate font-semibold" title={d.label}>
                {d.label}
              </span>
              <span className="flex items-center gap-2">
                <span className="relative h-5 flex-1">
                  <span
                    className="absolute inset-y-0 left-0 w-px bg-chart-grid"
                    aria-hidden="true"
                  />
                  <span
                    className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-1 transition-[width] duration-500"
                    style={{ width: `${Math.max(d.value > 0 ? 1 : 0, (d.value / top) * 100)}%` }}
                    aria-hidden="true"
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums">
                  {d.display ?? d.value}
                </span>
              </span>
              {d.note && (
                <span className="pointer-events-none absolute left-1/3 top-full z-10 mt-1 hidden w-max max-w-xs rounded-lg border-2 border-foreground bg-popover p-2 text-xs shadow-pop-sm group-hover:block group-focus:block">
                  {d.note}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </ChartFrame>
  );
}

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

/** Columns over time (one per day). The maximum is labelled; every value is in the tooltip and table. */
export function ColumnChart({
  title,
  description,
  data,
  valueHeader = "Value",
  format = (n: number) => compact.format(n),
}: {
  title: string;
  description?: string;
  data: Datum[];
  valueHeader?: string;
  format?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const top = Math.max(0, ...data.map((d) => d.value));
  const niceTop = top <= 0 ? 1 : top;
  const maxIdx = data.findIndex((d) => d.value === top);
  return (
    <ChartFrame
      title={title}
      description={description}
      data={data.map((d) => ({ ...d, display: d.display ?? format(d.value) }))}
      valueHeader={valueHeader}
    >
      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No data for this period.</p>
      ) : (
        <div>
          <div
            className="relative flex h-40 items-end gap-[2px] border-b border-chart-grid"
            onMouseLeave={() => setHover(null)}
          >
            <span className="absolute -top-1 left-0 text-[10px] font-bold text-muted-foreground">
              {format(niceTop)}
            </span>
            <span
              className="absolute inset-x-0 top-0 border-t border-chart-grid"
              aria-hidden="true"
            />
            {data.map((d, i) => (
              <button
                key={d.label}
                className="relative flex h-full min-w-0 flex-1 items-end justify-center focus-visible:outline-none"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${d.display ?? format(d.value)}`}
              >
                <span
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity",
                    hover !== null && hover !== i && "opacity-60",
                  )}
                  style={{
                    height: `${(d.value / niceTop) * 100}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                  }}
                />
                {i === maxIdx && hover === null && top > 0 && (
                  <span className="absolute -top-5 text-[10px] font-bold tabular-nums">
                    {d.display ?? format(d.value)}
                  </span>
                )}
                {hover === i && (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-lg border-2 border-foreground bg-popover px-2 py-1 text-xs shadow-pop-sm">
                    <span className="font-bold">{d.label}</span> · {d.display ?? format(d.value)}
                    {d.note && <span className="block text-muted-foreground">{d.note}</span>}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-semibold text-muted-foreground">
            <span>{data[0]!.label}</span>
            {data.length > 1 && <span>{data[data.length - 1]!.label}</span>}
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
