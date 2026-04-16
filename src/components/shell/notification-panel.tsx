"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Package,
  ClipboardCheck,
  CheckCircle,
  Bell,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/time-helpers";
import {
  isUnread,
  notificationUrl,
  type Notification,
  type NotificationsResponse,
} from "@/lib/notifications/types";

// ---------------------------------------------------------------------------
// Icon mapping based on eventType string
// ---------------------------------------------------------------------------
function NotificationIcon({
  eventType,
  className,
}: {
  eventType: string;
  className?: string;
}) {
  const base = cn("h-5 w-5 shrink-0", className);
  if (eventType.startsWith("breakdown")) {
    return <AlertTriangle className={cn(base, "text-red-500")} />;
  }
  if (eventType.startsWith("stock")) {
    return <Package className={cn(base, "text-amber-500")} />;
  }
  if (eventType.startsWith("checklist")) {
    return <ClipboardCheck className={cn(base, "text-blue-500")} />;
  }
  if (eventType.startsWith("action")) {
    return <CheckCircle className={cn(base, "text-green-500")} />;
  }
  return <Bell className={cn(base, "text-muted-foreground")} />;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function fetchNotifications(): Promise<NotificationsResponse> {
  const res = await fetch("/api/notifications");
  if (!res.ok) throw new Error("Bildirimler alınamadı");
  return res.json() as Promise<NotificationsResponse>;
}

async function markRead(payload: { ids: string[] } | { all: true }): Promise<void> {
  const res = await fetch("/api/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Okundu işareti başarısız");
}

// ---------------------------------------------------------------------------
// Individual notification row
// ---------------------------------------------------------------------------
interface NotificationRowProps {
  notification: Notification;
  onNavigate: (notification: Notification) => void;
  truncate?: boolean;
}

function NotificationRow({
  notification,
  onNavigate,
  truncate = true,
}: NotificationRowProps) {
  const unread = isUnread(notification);

  return (
    <button
      type="button"
      onClick={() => onNavigate(notification)}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
        unread && "bg-blue-50/60 dark:bg-blue-950/20"
      )}
    >
      <NotificationIcon eventType={notification.eventType} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm leading-tight",
            unread
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/80"
          )}
        >
          {notification.title}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs text-muted-foreground",
            truncate && "line-clamp-2"
          )}
        >
          {notification.body}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          {relativeTime(notification.createdAt)}
        </p>
      </div>
      {unread && (
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500"
          aria-label="Okunmamış"
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-count"] });
    },
  });

  const notifications = data?.notifications?.slice(0, 20) ?? [];
  const hasUnread = notifications.some(isUnread);

  function handleNavigate(notification: Notification) {
    if (isUnread(notification)) {
      markReadMutation.mutate({ ids: [notification.id] });
    }
    const url = notificationUrl(notification);
    onClose();
    if (url) router.push(url);
  }

  function handleMarkAllRead() {
    markReadMutation.mutate({ all: true });
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute right-0 top-full z-50 mt-2",
        // Full width on small screens, capped on larger
        "w-[calc(100vw-2rem)] max-w-sm sm:max-w-md",
        "rounded-xl border bg-background shadow-xl"
      )}
      role="dialog"
      aria-label="Bildirimler"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold text-base">Bildirimler</h2>
        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markReadMutation.isPending}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Tümünü Okundu İşaretle
          </button>
        )}
      </div>

      {/* Body */}
      <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain divide-y">
        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Bildirim yok</p>
          </div>
        )}

        {notifications.map((n) => (
          <NotificationRow
            key={n.id}
            notification={n}
            onNavigate={handleNavigate}
            truncate
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2.5">
        <button
          type="button"
          onClick={() => {
            onClose();
            router.push("/bildirimler");
          }}
          className="flex w-full items-center justify-center gap-1.5 text-sm text-primary hover:underline"
        >
          Tüm bildirimleri gör
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
