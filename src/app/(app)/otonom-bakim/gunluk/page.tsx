"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ClipboardCheck, ClipboardList } from "lucide-react";
import { recordStatusLabel, recordStatusVariant, periodLabel } from "@/lib/checklist-helpers";
import { formatDateTime } from "@/lib/breakdown-helpers";
import type { ChecklistRecord } from "@/types/checklist";

export default function GunlukKontrollerPage() {
  const { data: records, isLoading, isError } = useQuery<ChecklistRecord[]>({
    queryKey: ["checklist-records", "my"],
    queryFn: () => fetch("/api/checklists/my").then((r) => r.json()),
  });

  const pending = records?.filter((r) => r.status === "pending") ?? [];
  const inProgress = records?.filter((r) => r.status === "in_progress") ?? [];
  const completed = records?.filter((r) => r.status === "completed") ?? [];
  const missed = records?.filter((r) => r.status === "missed") ?? [];

  const activeCount = pending.length + inProgress.length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Bugünkü Kontrol Listeleri</h1>
          {activeCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {activeCount} bekleyen göreviniz var
            </p>
          )}
        </div>
        <Badge variant={activeCount > 0 ? "danger" : "success"} className="text-sm px-3 py-1">
          {activeCount > 0 ? `${activeCount} bekliyor` : "Tümü tamamlandı"}
        </Badge>
      </div>

      {isLoading && (
        <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>
      )}

      {isError && (
        <div className="py-20 text-center text-destructive text-sm">
          Kontrol listeleri yüklenemedi.
        </div>
      )}

      {!isLoading && !isError && records?.length === 0 && (
        <div className="py-20 text-center space-y-2">
          <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">Bugün için atanmış kontrol listeniz yok.</p>
        </div>
      )}

      {inProgress.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            Devam Ediyor
            <Badge variant="default" className="text-xs">{inProgress.length}</Badge>
          </h2>
          {inProgress.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            Bekleyen
            <Badge variant="secondary" className="text-xs">{pending.length}</Badge>
          </h2>
          {pending.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </section>
      )}

      {completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            Tamamlanan
            <Badge variant="success" className="text-xs">{completed.length}</Badge>
          </h2>
          {completed.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </section>
      )}

      {missed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            Kaçırılan
            <Badge variant="danger" className="text-xs">{missed.length}</Badge>
          </h2>
          {missed.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
        </section>
      )}
    </div>
  );
}

function RecordCard({ record }: { record: ChecklistRecord }) {
  const isPending = record.status === "pending";
  const isInProgress = record.status === "in_progress";
  const isCompleted = record.status === "completed";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base truncate">
                {record.machine?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {record.machine?.code}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {record.template?.name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge variant={recordStatusVariant(record.status)}>
                {recordStatusLabel(record.status)}
              </Badge>
              {record.template?.period && (
                <span className="text-xs text-muted-foreground">
                  {periodLabel(record.template.period)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-muted-foreground">
              <span>Planlanan: {formatDateTime(record.scheduledFor)}</span>
              {isCompleted && record.completedAt && (
                <span className="ml-2 text-green-600">
                  · Tamamlandı: {formatDateTime(record.completedAt)}
                </span>
              )}
            </div>
            {(isPending || isInProgress) && (
              <Link
                href={`/otonom-bakim/kontrol/${record.id}`}
                className={buttonVariants({
                  size: "sm",
                  variant: isInProgress ? "default" : "outline",
                })}
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                {isInProgress ? "Devam Et" : "Başla"}
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
