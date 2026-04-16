"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  AlertTriangle,
  Package,
  ClipboardCheck,
  CheckCircle,
  Bell,
  CheckCheck,
  Settings,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/time-helpers";
import {
  isUnread,
  notificationUrl,
  type Notification,
  type NotificationsResponse,
} from "@/lib/notifications/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

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
// Page
// ---------------------------------------------------------------------------
export default function BildirimlerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, isLoading, isError } = useQuery({
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

  const allNotifications = data?.notifications ?? [];
  const filtered = showUnreadOnly
    ? allNotifications.filter(isUnread)
    : allNotifications;
  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const hasUnread = allNotifications.some(isUnread);

  function handleNavigate(notification: Notification) {
    if (isUnread(notification)) {
      markReadMutation.mutate({ ids: [notification.id] });
    }
    const url = notificationUrl(notification);
    if (url) router.push(url);
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Bildirimler</h1>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markReadMutation.mutate({ all: true })}
              disabled={markReadMutation.isPending}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              Tümünü Okundu İşaretle
            </Button>
          )}
          <Link
            href="/bildirimler/tercihler"
            className="inline-flex items-center gap-2 h-9 rounded-md px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Tercihler
          </Link>
        </div>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setShowUnreadOnly((v) => !v);
            setVisibleCount(PAGE_SIZE);
          }}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium border transition-colors",
            showUnreadOnly
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted border-input"
          )}
        >
          Sadece okunmamış
          {data?.unreadCount != null && data.unreadCount > 0 && (
            <span
              className={cn(
                "ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-bold",
                showUnreadOnly
                  ? "bg-primary-foreground text-primary"
                  : "bg-red-500 text-white"
              )}
            >
              {data.unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {isError && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-destructive">Bildirimler yüklenemedi.</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !isError && filtered.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Bildirim yok</p>
          </CardContent>
        </Card>
      )}

      {/* Notification list */}
      {!isLoading && !isError && visible.length > 0 && (
        <Card className="overflow-hidden divide-y">
          {visible.map((notification) => {
            const unread = isUnread(notification);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNavigate(notification)}
                className={cn(
                  "flex w-full items-start gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/60",
                  unread && "bg-blue-50/60 dark:bg-blue-950/20"
                )}
              >
                <NotificationIcon
                  eventType={notification.eventType}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm leading-snug",
                      unread
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/80"
                    )}
                  >
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-line">
                    {notification.body}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground/70">
                    {relativeTime(notification.createdAt)}
                  </p>
                </div>
                {unread && (
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500"
                    aria-label="Okunmamış"
                  />
                )}
              </button>
            );
          })}
        </Card>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            Daha fazla göster
          </Button>
        </div>
      )}
    </div>
  );
}
