"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  statusLabel,
  statusVariant,
  priorityLabel,
  priorityVariant,
  typeLabel,
  formatDateTime,
} from "@/lib/breakdown-helpers";
import {
  workOrderStatusLabel,
  workOrderStatusVariant,
  formatDateTime as formatDateTimePm,
} from "@/lib/pm-helpers";
import type { BreakdownListItem, BreakdownStatus, BreakdownTransitionPayload } from "@/types/breakdown";

interface WorkOrderItem {
  id: string;
  status: string;
  scheduledFor: string;
  machine: { id: string; name: string; code: string };
  pmPlan: { id: string; name: string; estimatedDurationMinutes: number | null; taskList: string[] } | null;
}

interface MyWorkOrders {
  today: WorkOrderItem[];
  upcoming: WorkOrderItem[];
}

const STATUS_ORDER: BreakdownStatus[] = ["IN_PROGRESS", "ASSIGNED", "WAITING_PARTS"];

const STATUS_GROUP_LABELS: Record<string, string> = {
  IN_PROGRESS: "Devam Eden Müdahaleler",
  ASSIGNED: "Atanan Görevler",
  WAITING_PARTS: "Parça Bekleyenler",
};

export default function GorevlerimPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const role = (session?.user as { role?: string } | undefined)?.role;

  const { data: tasks, isLoading, isError } = useQuery<BreakdownListItem[]>({
    queryKey: ["breakdowns", "my"],
    queryFn: () => fetch("/api/breakdowns/my").then((r) => r.json()),
    enabled: role === "TECHNICIAN",
  });

  const { data: myWorkOrders, isLoading: isLoadingWo } = useQuery<MyWorkOrders>({
    queryKey: ["work-orders", "my"],
    queryFn: () => fetch("/api/work-orders/my").then((r) => r.json()),
    enabled: role === "TECHNICIAN",
  });

  const transitionMutation = useMutation<
    BreakdownListItem,
    Error,
    { id: string; payload: BreakdownTransitionPayload }
  >({
    mutationFn: ({ id, payload }) =>
      fetch(`/api/breakdowns/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "İşlem gerçekleştirilemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
    },
  });

  if (role && role !== "TECHNICIAN") {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">
        Bu sayfa yalnızca teknisyenlere özeldir.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>
    );
  }

  if (isError) {
    return (
      <div className="py-20 text-center text-destructive text-sm">
        Görevler yüklenemedi.
      </div>
    );
  }

  const grouped = STATUS_ORDER.reduce<Record<string, BreakdownListItem[]>>((acc, status) => {
    acc[status] = (tasks ?? []).filter((t) => t.status === status);
    return acc;
  }, {} as Record<string, BreakdownListItem[]>);

  const totalCount = (tasks ?? []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Görevlerim</h1>
        {totalCount > 0 && (
          <Badge variant="default" className="text-sm px-3 py-1">
            {totalCount} aktif görev
          </Badge>
        )}
      </div>

      {STATUS_ORDER.map((status) => {
        const items = grouped[status] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={status} className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              {STATUS_GROUP_LABELS[status]}
              <Badge variant={statusVariant(status)} className="text-xs">
                {items.length}
              </Badge>
            </h2>
            <div className="space-y-3">
              {items.map((task) => (
                <Card key={task.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/arizalar/${task.id}`}
                            className="font-mono text-sm font-semibold text-primary hover:underline"
                          >
                            {task.code}
                          </Link>
                          <p className="text-base font-medium mt-0.5 truncate">
                            {task.machine.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {task.machine.code}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant={priorityVariant(task.priority)}>
                            {priorityLabel(task.priority)}
                          </Badge>
                          <Badge variant={statusVariant(task.status)}>
                            {statusLabel(task.status)}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {typeLabel(task.type)} · {formatDateTime(task.reportedAt)}
                        </span>
                        <div className="flex gap-2">
                          {task.status === "ASSIGNED" && (
                            <Button
                              size="sm"
                              className="h-9 text-sm"
                              onClick={() =>
                                transitionMutation.mutate({
                                  id: task.id,
                                  payload: { status: "IN_PROGRESS" },
                                })
                              }
                              disabled={transitionMutation.isPending}
                            >
                              Başla
                            </Button>
                          )}
                          {task.status === "IN_PROGRESS" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 text-sm"
                                onClick={() =>
                                  transitionMutation.mutate({
                                    id: task.id,
                                    payload: { status: "WAITING_PARTS" },
                                  })
                                }
                                disabled={transitionMutation.isPending}
                              >
                                Parça Gerekli
                              </Button>
                              <Link href={`/arizalar/${task.id}`}>
                                <Button size="sm" className="h-9 text-sm">
                                  Tamamla
                                </Button>
                              </Link>
                            </>
                          )}
                          {task.status === "WAITING_PARTS" && (
                            <Button
                              size="sm"
                              className="h-9 text-sm"
                              onClick={() =>
                                transitionMutation.mutate({
                                  id: task.id,
                                  payload: { status: "IN_PROGRESS" },
                                })
                              }
                              disabled={transitionMutation.isPending}
                            >
                              Parça Geldi
                            </Button>
                          )}
                          <Link
                            href={`/arizalar/${task.id}`}
                            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 self-center"
                          >
                            Detay
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {/* Work Orders Section */}
      {!isLoadingWo && myWorkOrders && (myWorkOrders.today.length > 0 || myWorkOrders.upcoming.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Planlı Bakım İş Emirleri
          </h2>

          {myWorkOrders.today.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Bugün</p>
              {myWorkOrders.today.map((wo) => (
                <Card key={wo.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-medium truncate">{wo.machine.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{wo.machine.code}</p>
                          {wo.pmPlan && (
                            <p className="text-xs text-muted-foreground mt-0.5">{wo.pmPlan.name}</p>
                          )}
                        </div>
                        <Badge variant={workOrderStatusVariant(wo.status)}>
                          {workOrderStatusLabel(wo.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimePm(wo.scheduledFor)}
                        </span>
                        <Link
                          href={`/is-emirleri/${wo.id}`}
                          className="text-xs text-primary hover:underline underline-offset-2"
                        >
                          Detay
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {myWorkOrders.upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Yaklaşan (7 gün)</p>
              {myWorkOrders.upcoming.map((wo) => (
                <Card key={wo.id} className="overflow-hidden border-dashed">
                  <CardContent className="p-0">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-medium truncate">{wo.machine.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{wo.machine.code}</p>
                          {wo.pmPlan && (
                            <p className="text-xs text-muted-foreground mt-0.5">{wo.pmPlan.name}</p>
                          )}
                        </div>
                        <Badge variant={workOrderStatusVariant(wo.status)}>
                          {workOrderStatusLabel(wo.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTimePm(wo.scheduledFor)}
                        </span>
                        <Link
                          href={`/is-emirleri/${wo.id}`}
                          className="text-xs text-primary hover:underline underline-offset-2"
                        >
                          Detay
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {!isLoadingWo && myWorkOrders && myWorkOrders.today.length === 0 && myWorkOrders.upcoming.length === 0 && totalCount === 0 && (
        <div className="py-20 text-center text-muted-foreground text-sm">
          Atanmış aktif göreviniz bulunmuyor.
        </div>
      )}
    </div>
  );
}
