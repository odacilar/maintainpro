"use client";

import { signOut } from "next-auth/react";
import { Menu, LogOut, ChevronDown, Bell, Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUIStore } from "@/stores/ui-store";
import { roleLabels, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { NotificationPanel } from "./notification-panel";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { NotificationCountResponse } from "@/lib/notifications/types";

interface TopbarProps {
  user: {
    name: string;
    role: Role;
    factoryName: string | null;
  };
  onOpenSearch?: () => void;
}

async function fetchNotificationCount(): Promise<NotificationCountResponse> {
  const res = await fetch("/api/notifications/count");
  if (!res.ok) throw new Error("Bildirim sayısı alınamadı");
  return res.json() as Promise<NotificationCountResponse>;
}

export function Topbar({ user, onOpenSearch }: TopbarProps) {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ["notifications-count"],
    queryFn: fetchNotificationCount,
    refetchInterval: 30_000,
    // Don't throw on error — badge simply won't show
    retry: false,
  });

  const unreadCount = countData?.count ?? 0;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-md hover:bg-muted"
          aria-label="Menüyü aç"
        >
          <Menu className="h-5 w-5" />
        </button>
        {user.factoryName && (
          <span className="hidden sm:block text-sm font-medium text-muted-foreground">
            {user.factoryName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search button */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            title="Ara (Ctrl+K)"
            aria-label="Ara"
            className="flex h-9 items-center gap-2 rounded-md border bg-muted/50 px-2 sm:px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="hidden md:inline">Ara...</span>
            <kbd className="hidden md:inline-flex items-center gap-1 font-mono text-xs opacity-60">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notification Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen((o) => !o);
              // Close user menu if open
              setMenuOpen(false);
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
            aria-label={`Bildirimler${unreadCount > 0 ? `, ${unreadCount} okunmamış` : ""}`}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                className={cn(
                  "absolute right-1 top-1 flex items-center justify-center",
                  "min-w-[1.125rem] h-[1.125rem] rounded-full",
                  "bg-red-500 text-white text-[10px] font-bold leading-none px-0.5"
                )}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <NotificationPanel onClose={() => setNotifOpen(false)} />
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setMenuOpen((o) => !o);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted text-sm"
          >
            <span className="font-medium">{user.name}</span>
            <span className="hidden sm:block text-xs text-muted-foreground">
              {roleLabels[user.role]}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border bg-background shadow-md">
                <div className="px-3 py-2 border-b">
                  <p className="text-xs font-medium truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/giris" })}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-destructive"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                  Çıkış Yap
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
