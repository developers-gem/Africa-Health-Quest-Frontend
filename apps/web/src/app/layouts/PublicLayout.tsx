import { Menu } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { KenteStrip } from "@/components/game/KenteStrip";
import { AccountMenu, SignInButtons } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSessionStore } from "@/lib/auth/session-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/about", label: "About" },
  { to: "/how-to-play", label: "How to play" },
  { to: "/learn", label: "Learning" },
  { to: "/countries", label: "Countries" },
];

export function PublicLayout() {
  const status = useSessionStore((s) => s.status);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-2"
      >
        Skip to content
      </a>
      <KenteStrip />
      <header className="sticky top-0 z-40 border-b-2 border-foreground/10 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-bold hover:bg-muted",
                    isActive && "bg-muted text-primary",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {status === "authenticated" ? (
              <>
                <Button asChild size="sm" className="hidden sm:inline-flex">
                  <Link to="/play">Play now</Link>
                </Button>
                <AccountMenu />
              </>
            ) : (
              <SignInButtons />
            )}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-6" />
            </Button>
          </div>
        </div>
      </header>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent side="left" aria-describedby={undefined}>
          <DialogTitle className="mb-4">Menu</DialogTitle>
          <nav className="flex flex-col gap-1" aria-label="Mobile">
            {[{ to: "/", label: "Home" }, ...NAV, { to: "/play", label: "Play" }].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-3 font-bold hover:bg-muted",
                    isActive && "bg-muted text-primary",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </DialogContent>
      </Dialog>
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-16 border-t-2 border-foreground/10 bg-card/60">
        <KenteStrip thin />
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
          <div className="space-y-2">
            <Logo />
            <p className="text-sm text-muted-foreground">Save Lives. Build Healthier Nations.</p>
          </div>
          <nav className="grid grid-cols-2 gap-2 text-sm font-semibold" aria-label="Footer">
            {[
              ...NAV,
              { to: "/play", label: "Play" },
              { to: "/status", label: "System status" },
            ].map((n) => (
              <Link key={n.to} to={n.to} className="hover:text-primary">
                {n.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            Educational game. Cases are reviewed by verified clinicians before publication. Nothing
            here is medical advice for a real patient.
          </p>
        </div>
      </footer>
    </div>
  );
}
