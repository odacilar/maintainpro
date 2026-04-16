"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { syncPendingActions, type SyncResult } from "@/lib/offline/sync-service";
import { cn } from "@/lib/utils";

type Status = "online" | "offline" | "syncing" | "synced";

export function OfflineIndicator() {
  const [status, setStatus] = useState<Status>("online");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    // Initialise from current browser state
    if (!navigator.onLine) {
      setStatus("offline");
    }

    function handleOffline() {
      setStatus("offline");
      setSyncResult(null);
    }

    async function handleOnline() {
      setStatus("syncing");
      const result = await syncPendingActions();
      setSyncResult(result);
      setStatus("synced");

      // Auto-hide the "synced" message after 3 seconds
      setTimeout(() => setStatus("online"), 3000);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", () => void handleOnline());

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", () => void handleOnline());
    };
  }, []);

  if (status === "online") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-sm font-medium",
        status === "offline" && "bg-amber-500 text-white",
        status === "syncing" && "bg-blue-600 text-white",
        status === "synced" && "bg-green-600 text-white"
      )}
    >
      {status === "offline" && (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Çevrimdışısınız — değişiklikler bağlantı kurulduğunda senkronize edilecek
          </span>
        </>
      )}

      {status === "syncing" && (
        <>
          <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
          <span>Çevrimiçi olundu, değişiklikler senkronize ediliyor...</span>
        </>
      )}

      {status === "synced" && syncResult && (
        <>
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>
            Senkronizasyon tamamlandı
            {syncResult.synced > 0 && ` — ${syncResult.synced} işlem gönderildi`}
            {syncResult.failed > 0 && `, ${syncResult.failed} başarısız`}
          </span>
        </>
      )}
    </div>
  );
}
