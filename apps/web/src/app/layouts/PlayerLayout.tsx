import { BookOpen, Building2, Globe2, Home, Stethoscope, User } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { RequireSession } from "@/app/guards";
import { FundingPill, HpPill } from "@/components/game/stats";
import { KenteStrip } from "@/components/game/KenteStrip";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { Logo } from "@/components/layout/Logo";
import { useProgress } from "@/lib/queries";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/play", label: "Home", icon: Home, end: true },
  { to: "/play/story", label: "Story", icon: BookOpen },
  { to: "/play/challenge", label: "Challenge", icon: Stethoscope },
  { to: "/play/commander", label: "Commander", icon: Building2 },
  { to: "/play/countries", label: "Countries", icon: Globe2 },
  { to: "/play/profile", label: "Profile", icon: User },
];

function Header() {
  const progress = useProgress();
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur">
      <KenteStrip />
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
        <Logo to="/play" compact />
        <div className="flex items-center gap-2">
          {progress.data && (
            <>
              <HpPill hp={progress.data.hp} />
              <FundingPill funding={progress.data.funding} />
            </>
          )}
          <AccountMenu />
        </div>
      </div>
      <nav className="mx-auto hidden max-w-5xl gap-1 px-4 pb-2 md:flex" aria-label="Game">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold hover:bg-muted",
                isActive && "bg-card ring-2 ring-foreground shadow-pop-sm",
              )
            }
          >
            <n.icon className="size-4" /> {n.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function PlayerLayout() {
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-2"
      >
        Skip to content
      </a>
      <RequireSession>
        <Header />
        <main id="main" className="mx-auto max-w-5xl px-4 pt-4">
          <Outlet />
        </main>
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t-2 border-foreground bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Game"
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold text-muted-foreground",
                  isActive && "text-primary",
                )
              }
            >
              <n.icon className="size-5" aria-hidden="true" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </RequireSession>
    </div>
  );
}
