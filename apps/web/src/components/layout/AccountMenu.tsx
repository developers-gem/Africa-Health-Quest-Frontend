import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Gamepad2, LogOut, Settings, Shield, User as UserIcon } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/api/endpoints";
import { useCan } from "@/lib/auth/permissions";
import { useSessionStore } from "@/lib/auth/session-store";

export function AccountMenu() {
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canReview = useCan("review:read");
  const isAdmin = useCan("users:read");
  if (!user) return null;
  const initials = user.displayName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex size-10 items-center justify-center rounded-full border-2 border-foreground bg-accent font-extrabold shadow-pop-sm"
          aria-label="Account menu"
          data-testid="account-menu"
        >
          {initials || "?"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="text-sm font-extrabold text-foreground">{user.displayName}</div>
          <div className="truncate">
            {user.isGuest ? "Guest — progress on this device" : user.email}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/play">
            <Gamepad2 /> Play
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/play/profile">
            <UserIcon /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/play/settings">
            <Settings /> Account settings
          </Link>
        </DropdownMenuItem>
        {canReview && (
          <DropdownMenuItem asChild>
            <Link to="/review">
              <ClipboardCheck /> Clinician review
            </Link>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <Shield /> Administration
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut().catch(() => undefined);
            qc.clear();
            navigate("/");
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SignInButtons() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm" className="rounded-full">
        <Link to="/login">Sign in</Link>
      </Button>
    </div>
  );
}
