"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/hooks/queries/useAuth";
import { useSessionStore } from "@/stores/sessionStore";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ collapsed }: { collapsed: boolean }) {
  const user = useSessionStore((state) => state.scope?.user);
  const logout = useLogout();
  const router = useRouter();

  if (!user) return null;

  return (
    <DropdownMenu>
      {/* Base UI composes via `render`, not Radix's `asChild`. */}
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-sidebar-accent/60"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback className="text-foreground">{initials(user.name)}</AvatarFallback>
        </Avatar>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Base UI requires GroupLabel to sit inside a Group — a standalone
            label (which Radix allowed) throws MenuGroupContext is missing
            and takes the whole menu down with it. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings/profile" />}>
          <User className="size-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings/organization" />}>
          <Settings className="size-4" /> Organization settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            await logout.mutateAsync();
            router.push("/login");
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
