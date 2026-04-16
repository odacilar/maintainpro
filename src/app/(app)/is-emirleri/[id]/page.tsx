"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import {
  workOrderStatusLabel,
  workOrderStatusVariant,
  priorityLabel,
  priorityVariant,
  frequencyLabel,
  formatDateTime,
  intervalDaysToFrequency,
  parsePriority,
} from "@/lib/pm-helpers";

interface WorkOrderDetail {
  id: string;
  status: string;
  scheduledFor: string;
  completedAt: string | null;
  actualDurationMinutes: number | null;
  notes: string | null;
  factoryId: string;
  assigneeId: string | null;
  machine: {
    id: string;
    name: string;
    code: string;
    department: { id: string; name: string } | null;
  };
  assignee: { id: string; name: string | null; email: string } | null;
  pmPlan: {
    id: string;
    name: string;
    maintenanceType: string;
    taskList: string[];
    estimatedDurationMinutes: number | null;
    intervalDays?: number;
  } | null;
}

interface TransitionPayload {
  status: string;
  notes?: string;
}

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export default function IsEmriDetayPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [showCompletePanel, setShowCompletePanel] = useState(false);
  const [completionNote, setCompletionNote] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: workOrder, isLoading, isError } = useQuery<WorkOrderDetail>({
    queryKey: ["work-orders", id],
    queryFn: () => fetch(`/api/work-orders/${id}`).then((r) => r.json()),
  });

  const transitionMutation = useMutation<WorkOrderDetail, Error, TransitionPayload>({
    mutationFn: (payload) =>
      fetch(`/api/work-orders/${id}/transition`, {
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
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["work-orders", id] });
      setShowCompletePanel(false);
      setTransitionError(null);
    },
    onError: (err) => {
      setTransitionError(err.message);
    },
  });

  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isEngineerOrAdmin = role === "ENGINEER" || role === "FACTORY_ADMIN" || role === "SUPER_ADMIN";
  const isTechnician = role === "TECHNICIAN";
  const isAssigned = workOrder?.assigneeId === userId;
  const canTransition = isEngineerOrAdmin || (isTechnician && isAssigned);

  function handleTransition(payload: TransitionPayload) {
    setTransitionError(null);
    transitionMutation.mutate(payload);
  }

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !workOrder) {
    return <div className="py-20 text-center text-destructive text-sm">İş emri bulunamadı.</div>;
  }

  const status = workOrder.status;
  const priority = workOrder.pmPlan ? parsePriority(workOrder.pmPlan.maintenanceType) : null;
  const frequency =
    workOrder.pmPlan?.intervalDays != null
      ? intervalDaysToFrequency(workOrder.pmPlan.intervalDays)
      : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/is-emirleri" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          İş Emirleri
        </Link>
        <h1 className="text-2xl font-semibold flex-1">İş Emri Detayı</h1>
        <div className="flex gap-2 items-center">
          {priority && (
            <Badge variant={priorityVariant(priority)}>{priorityLabel(priority)}</Badge>
          )}
          <Badge variant={workOrderStatusVariant(status)}>
            {workOrderStatusLabel(status)}
          </Badge>
        </div>
      </div>

      {transitionError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {transitionError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">İş Emri Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FieldRow
                label="Makine"
                value={
                  <Link
                    href={`/makineler/${workOrder.machine.id}`}
                    className="text-primary hover:underline"
                  >
                    {workOrder.machine.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      ({workOrder.machine.code})
                    </span>
                  </Link>
                }
              />
              <FieldRow label="Departman" value={workOrder.machine.department?.name ?? null} />
              <FieldRow
                label="Bakım Planı"
                value={
                  workOrder.pmPlan ? (
                    <Link
                      href={`/planli-bakim/${workOrder.pmPlan.id}`}
                      className="text-primary hover:underline"
                    >
                      {workOrder.pmPlan.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground italic">Manuel</span>
                  )
                }
              />
              <FieldRow
                label="Sorumlu"
                value={workOrder.assignee?.name ?? workOrder.assignee?.email ?? null}
              />
              <FieldRow label="Planlanan Tarih" value={formatDateTime(workOrder.scheduledFor)} />
              {workOrder.completedAt && (
                <FieldRow label="Tamamlanma Tarihi" value={formatDateTime(workOrder.completedAt)} />
              )}
              {frequency && (
                <FieldRow label="Frekans" value={frequencyLabel(frequency)} />
              )}
              {workOrder.pmPlan?.estimatedDurationMinutes != null && (
                <FieldRow
                  label="Tahmini Süre"
                  value={`${workOrder.pmPlan.estimatedDurationMinutes} dk`}
                />
              )}
              {workOrder.actualDurationMinutes != null && (
                <FieldRow
                  label="Gerçekleşen Süre"
                  value={`${workOrder.actualDurationMinutes} dk`}
                />
              )}
            </div>

            {workOrder.notes && (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notlar
                </p>
                <p className="text-sm whitespace-pre-wrap">{workOrder.notes}</p>
              </div>
            )}

            {workOrder.pmPlan && workOrder.pmPlan.taskList.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Görev Listesi
                </p>
                <ul className="space-y-1 text-sm">
                  {workOrder.pmPlan.taskList.map((task, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 h-4 w-4 rounded-sm border border-muted-foreground/30 shrink-0" />
                      <span className="text-muted-foreground">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Durum Geçişi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!canTransition && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Bu iş emri için işlem yetkiniz bulunmuyor.
              </p>
            )}

            {canTransition && status === "PLANNED" && (
              <Button
                className="w-full"
                onClick={() => handleTransition({ status: "IN_PROGRESS" })}
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? "İşleniyor..." : "Başlat"}
              </Button>
            )}

            {canTransition && status === "IN_PROGRESS" && (
              <>
                {!showCompletePanel ? (
                  <Button
                    className="w-full"
                    onClick={() => setShowCompletePanel(true)}
                  >
                    Tamamlandı
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="completionNote">Tamamlama Notu (opsiyonel)</Label>
                      <Textarea
                        id="completionNote"
                        rows={3}
                        placeholder="Yapılan işlemleri açıklayın..."
                        value={completionNote}
                        onChange={(e) => setCompletionNote(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          handleTransition({
                            status: "COMPLETED",
                            notes: completionNote.trim() || undefined,
                          })
                        }
                        disabled={transitionMutation.isPending}
                      >
                        {transitionMutation.isPending ? "Kaydediliyor..." : "Tamamla"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCompletePanel(false)}
                        disabled={transitionMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {canTransition && (status === "PLANNED" || status === "IN_PROGRESS") && isEngineerOrAdmin && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleTransition({ status: "CANCELLED" })}
                disabled={transitionMutation.isPending}
              >
                İptal Et
              </Button>
            )}

            {status === "COMPLETED" && (
              <div className="text-center py-2 space-y-1">
                <p className="text-sm text-success font-medium">Tamamlandı</p>
                {workOrder.completedAt && (
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(workOrder.completedAt)}
                  </p>
                )}
              </div>
            )}

            {status === "CANCELLED" && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Bu iş emri iptal edilmiştir.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
