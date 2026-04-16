"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QrCode, Plus, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  statusLabel,
  statusVariant,
  priorityLabel,
  priorityVariant,
  formatDateTime,
} from "@/lib/breakdown-helpers";
import type { BreakdownListItem, BreakdownTransitionPayload } from "@/types/breakdown";
import type { ChecklistRecord } from "@/types/checklist";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TechnicianDashboardData {
  assignedBreakdowns: BreakdownListItem[];
  todayChecklists: ChecklistRecord[];
  recentActivities: ActivityItem[];
}

interface ActivityItem {
  id: string;
  timestamp: string;
  description: string;
  type: "breakdown" | "checklist" | "action";
  status?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function checklistStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Bekliyor",
    in_progress: "Devam Ediyor",
    completed: "Tamamlandı",
    missed: "Kaçırıldı",
  };
  return map[status] ?? status;
}

function checklistStatusVariant(
  status: string
): "secondary" | "warning" | "success" | "danger" {
  const map: Record<string, "secondary" | "warning" | "success" | "danger"> = {
    pending: "secondary",
    in_progress: "warning",
    completed: "success",
    missed: "danger",
  };
  return map[status] ?? "secondary";
}

function activityIcon(type: ActivityItem["type"]) {
  if (type === "breakdown") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  if (type === "checklist") return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />;
  return <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
}

// ─── Technician Dashboard ─────────────────────────────────────────────────────

export default function TechnicianDashboard() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<TechnicianDashboardData>({
    queryKey: ["dashboard", "technician"],
    queryFn: () => fetch("/api/dashboard/technician").then((r) => r.json()),
    refetchInterval: 30_000,
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
      queryClient.invalidateQueries({ queryKey: ["dashboard", "technician"] });
      queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16 text-center text-destructive text-sm">
        Pano verileri yüklenemedi.
      </div>
    );
  }

  const breakdowns = data?.assignedBreakdowns ?? [];
  const checklists = data?.todayChecklists ?? [];
  const activities = data?.recentActivities ?? [];

  // Sort breakdowns: CRITICAL first, then by priority weight
  const PRIORITY_WEIGHT: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedBreakdowns = [...breakdowns].sort(
    (a, b) => (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9)
  );

  const completedChecklist = checklists.filter((c) => c.status === "completed").length;

  return (
    <div className="space-y-6 max-w-xl mx-auto md:max-w-none">

      {/* ── Section 1: Bana Atanan Arızalar ──────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Bana Atanan Arızalar</h2>
          {breakdowns.length > 0 && (
            <Badge variant="danger" className="text-xs">{breakdowns.length}</Badge>
          )}
        </div>

        {sortedBreakdowns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Atanmış arızanız bulunmuyor.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedBreakdowns.map((bd) => (
              <Card key={bd.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/arizalar/${bd.id}`}
                          className="font-mono text-sm font-semibold text-primary hover:underline"
                        >
                          {bd.code}
                        </Link>
                        <p className="text-base font-medium mt-0.5 truncate">{bd.machine.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{bd.machine.code}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <Badge variant={priorityVariant(bd.priority)}>
                          {priorityLabel(bd.priority)}
                        </Badge>
                        <Badge variant={statusVariant(bd.status)}>
                          {statusLabel(bd.status)}
                        </Badge>
                      </div>
                    </div>

                    {/* Description */}
                    {bd.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {bd.description}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(bd.reportedAt)}
                      </span>
                      <div className="flex gap-2">
                        {bd.status === "ASSIGNED" && (
                          <Button
                            size="sm"
                            className="h-9 min-w-[80px]"
                            onClick={() =>
                              transitionMutation.mutate({
                                id: bd.id,
                                payload: { status: "IN_PROGRESS" },
                              })
                            }
                            disabled={transitionMutation.isPending}
                          >
                            Başla
                          </Button>
                        )}
                        {bd.status === "IN_PROGRESS" && (
                          <Link href={`/arizalar/${bd.id}`}>
                            <Button size="sm" className="h-9 min-w-[80px]">
                              Tamamla
                            </Button>
                          </Link>
                        )}
                        {bd.status === "WAITING_PARTS" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 min-w-[80px]"
                            onClick={() =>
                              transitionMutation.mutate({
                                id: bd.id,
                                payload: { status: "IN_PROGRESS" },
                              })
                            }
                            disabled={transitionMutation.isPending}
                          >
                            Parça Geldi
                          </Button>
                        )}
                        <Link
                          href={`/arizalar/${bd.id}`}
                          className="self-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
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
        )}
      </section>

      {/* ── Section 2: Bugünkü Kontroller ────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Bugünkü Kontroller</h2>
          {checklists.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {completedChecklist}/{checklists.length} tamamlandı
            </span>
          )}
        </div>

        {checklists.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Bugün için kontrol görevi bulunmuyor.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Completion progress bar */}
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{
                  width: checklists.length > 0
                    ? `${(completedChecklist / checklists.length) * 100}%`
                    : "0%",
                }}
              />
            </div>

            <div className="space-y-2">
              {checklists.map((checklist) => (
                <Card key={checklist.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {checklist.template?.name ?? "Kontrol Listesi"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {checklist.machine?.name ?? ""} &middot; {checklist.machine?.code ?? ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={checklistStatusVariant(checklist.status)}>
                          {checklistStatusLabel(checklist.status)}
                        </Badge>
                        {checklist.status === "pending" && (
                          <Link href={`/otonom-bakim/${checklist.id}`}>
                            <Button size="sm" className="h-8 text-xs">
                              Başla
                            </Button>
                          </Link>
                        )}
                        {checklist.status === "in_progress" && (
                          <Link href={`/otonom-bakim/${checklist.id}`}>
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              Devam Et
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Section 3: Hızlı Arıza Bildir ───────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Hızlı İşlem</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/arizalar/yeni" className="block">
            <Button className="w-full h-14 text-base gap-2" size="lg">
              <Plus className="h-5 w-5" />
              Hızlı Arıza Bildir
            </Button>
          </Link>
          <Link href="/arizalar/yeni?qr=1" className="block">
            <Button variant="outline" className="w-full h-14 text-base gap-2" size="lg">
              <QrCode className="h-5 w-5" />
              QR Tara
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Section 4: Son Aktiviteler ────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Son Aktiviteler</h2>
        {activities.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Son 7 günde aktivite bulunmuyor.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <ul className="space-y-0 divide-y">
                {activities.map((act) => (
                  <li key={act.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    {activityIcon(act.type)}
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm">{act.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(act.timestamp)}
                        {act.status && (
                          <>
                            {" · "}
                            <span>{act.status}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
