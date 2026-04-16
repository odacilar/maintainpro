"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { ShortcutsHelp } from "./shortcuts-help";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import type { Role } from "@/lib/auth/roles";
import { useRealtimeInvalidation } from "@/lib/events/client";
import { registerServiceWorker } from "@/lib/pwa";
import { startSyncListener } from "@/lib/offline/sync-service";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useRealtimeInvalidation();

  // Register PWA service worker and start offline sync listener on mount
  useEffect(() => {
    void registerServiceWorker();
    startSyncListener();
  }, []);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onOpenSearch: () => setSearchOpen(true),
    onOpenHelp: () => setHelpOpen(true),
    onEscape: () => {
      setSearchOpen(false);
      setHelpOpen(false);
    },
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/giris");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">Yükleniyor...</p>
      </div>
    );
  }

  if (!session?.user) return null;

  const user = {
    name: session.user.name ?? "Kullanıcı",
    role: session.user.role as Role,
    factoryName: session.user.factoryName ?? null,
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden lg:ml-0">
        <Topbar user={user} onOpenSearch={() => setSearchOpen(true)} />
        <OfflineIndicator />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
