import type { Permission } from "@ahq/shared-types";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { RequirePermission } from "@/app/guards";
import { KenteStrip } from "@/components/game/KenteStrip";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MfaGate } from "@/features/account/MfaGate";
import { can } from "@/lib/auth/permissions";
import { useSessionStore } from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";

export type ConsoleNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  perms?: Permission[];
  end?: boolean;
};

function NavList({ items, onNavigate }: { items: ConsoleNavItem[]; onNavigate?: () => void }) {
  const user = useSessionStore((s) => s.user);
  return (
    <nav className="flex flex-col gap-1" aria-label="Console">
      {items
        .filter((i) => !i.perms || can(user, ...i.perms))
        .map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-foreground/80 hover:bg-muted",
                isActive && "bg-card text-foreground ring-2 ring-foreground shadow-pop-sm",
              )
            }
          >
            <i.icon className="size-4" aria-hidden="true" />
            {i.label}
          </NavLink>
        ))}
    </nav>
  );
}

/** Shared shell for the clinician and admin applications (sidebar on desktop, drawer on mobile). */
export function ConsoleLayout({
  title,
  items,
  perms,
}: {
  title: string;
  items: ConsoleNavItem[];
  perms: Permission[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <RequirePermission perms={perms}>
      <div className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-2"
        >
          Skip to content
        </a>
        <KenteStrip />
        <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-6" />
              </Button>
              <Logo to="/" compact />
              <span className="hidden rounded-full border-2 border-foreground bg-accent px-2.5 py-0.5 text-xs font-extrabold sm:inline">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link to="/play">Back to game</Link>
              </Button>
              <AccountMenu />
            </div>
          </div>
        </header>
        <div className="flex">
          <aside className="sticky top-[72px] hidden h-[calc(100dvh-72px)] w-64 shrink-0 overflow-y-auto border-r-2 border-foreground/10 p-4 lg:block">
            <NavList items={items} />
          </aside>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent side="left" aria-describedby={undefined}>
              <DialogTitle className="mb-4">{title}</DialogTitle>
              <NavList items={items} onNavigate={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
          <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <MfaGate>
              <Outlet />
            </MfaGate>
          </main>
        </div>
      </div>
    </RequirePermission>
  );
}
