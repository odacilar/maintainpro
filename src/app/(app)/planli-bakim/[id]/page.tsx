"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus } from "lucide-react";
import {
  frequencyLabel,
  priorityLabel,
  priorityVariant,
  workOrderStatusLabel,
  workOrderStatusVariant,
  formatDate,
  formatDateTime,
  intervalDaysToFrequency,
  parsePriority,
  parseDescription,
} from "@/lib/pm-helpers";

interface TechnicianUser {
  id: string;
  name: string | null;
  email: string;
}

interface WorkOrderRow {
  id: string;
  status: string;
  scheduledFor: string;
  completedAt: string | null;
  actualDurationMinutes: number | null;
  assignee: { id: string; name: string | null } | null;
}

interface PmPlanDetail {
  id: string;
  name: string;
  machineId: string;
  machine: {
    id: string;
    name: string;
    code: string;
    department: { id: string; name: string } | null;
  };
  maintenanceType: string;
  intervalDays: number;
  isActive: boolean;
  nextScheduledAt: string | null;
  lastExecutedAt: string | null;
  estimatedDurationMinutes: number | null;
  taskList: string[];
  workOrders: WorkOrderRow[];
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

export default function PlanDetayPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showNewOrderPanel, setShowNewOrderPanel] = useState(false);
  const [orderDate, setOrderDate] = useState("");
  const [orderAssigneeId, setOrderAssigneeId] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderError, setOrderError] = useState<string | null>(null);

  const { data: plan, isLoading, isError } = useQuery<PmPlanDetail>({
    queryKey: ["pm-plans", id],
    queryFn: () => fetch(`/api/pm-plans/${id}`).then((r) => r.json()),
  });

  const { data: technicians } = useQuery<TechnicianUser[]>({
    queryKey: ["technicians"],
    queryFn: () => fetch("/api/users/technicians").then((r) => r.json()),
    enabled: showNewOrderPanel,
  });

  const createOrderMutation = useMutation<{ id: string }, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetch("/api/work-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "İş emri oluşturulamadı.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-plans", id] });
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setShowNewOrderPanel(false);
      setOrderDate("");
      setOrderAssigneeId("");
      setOrderNotes("");
      setOrderError(null);
    },
    onError: (err) => {
      setOrderError(err.message);
    },
  });

  function handleCreateOrder() {
    if (!orderDate) {
      setOrderError("Planlanan tarih zorunludur.");
      return;
    }
    if (!plan) return;
    setOrderError(null);

    const payload: Record<string, unknown> = {
      machineId: plan.machineId,
      pmPlanId: plan.id,
      scheduledDate: new Date(orderDate).toISOString(),
    };
    if (orderAssigneeId) payload.assigneeId = orderAssigneeId;
    if (orderNotes.trim()) payload.notes = orderNotes.trim();

    createOrderMutation.mutate(payload);
  }

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !plan) {
    return <div className="py-20 text-center text-destructive text-sm">Plan bulunamadı.</div>;
  }

  const priority = parsePriority(plan.maintenanceType);
  const description = parseDescription(plan.maintenanceType);
  const frequency = intervalDaysToFrequency(plan.intervalDays);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/planli-bakim" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Planlı Bakım
        </Link>
        <h1 className="text-2xl font-semibold flex-1">{plan.name}</h1>
        <div className="flex gap-2">
          <Badge variant={plan.isActive ? "success" : "secondary"}>
            {plan.isActive ? "Aktif" : "Pasif"}
          </Badge>
          <Badge variant={priorityVariant(priority)}>{priorityLabel(priority)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Plan Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FieldRow
                label="Makine"
                value={
                  <Link
                    href={`/makineler/${plan.machine.id}`}
                    className="text-primary hover:underline"
                  >
                    {plan.machine.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      ({plan.machine.code})
                    </span>
                  </Link>
                }
              />
              <FieldRow label="Departman" value={plan.machine.department?.name ?? null} />
              <FieldRow label="Frekans" value={frequencyLabel(frequency)} />
              <FieldRow label="Öncelik" value={priorityLabel(priority)} />
              {plan.estimatedDurationMinutes != null && (
                <FieldRow
                  label="Tahmini Süre"
                  value={`${plan.estimatedDurationMinutes} dk`}
                />
              )}
              <FieldRow
                label="Son Çalıştırma"
                value={plan.lastExecutedAt ? formatDate(plan.lastExecutedAt) : null}
              />
              <FieldRow
                label="Sonraki Planlanan"
                value={plan.nextScheduledAt ? formatDate(plan.nextScheduledAt) : null}
              />
            </div>
            {description && (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Açıklama
                </p>
                <p className="text-sm whitespace-pre-wrap">{description}</p>
              </div>
            )}
            {plan.taskList.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Talimatlar
                </p>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  {plan.taskList.map((task, idx) => (
                    <li key={idx}>{task}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İşlemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`/planli-bakim/${plan.id}/duzenle`}
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Düzenle
            </Link>
            {!showNewOrderPanel ? (
              <Button className="w-full" onClick={() => setShowNewOrderPanel(true)}>
                <Plus className="h-4 w-4 mr-2" />
                İş Emri Oluştur
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Yeni İş Emri</p>
                {orderError && (
                  <p className="text-xs text-destructive">{orderError}</p>
                )}
                <div className="space-y-1">
                  <Label htmlFor="orderDate" className="text-xs">
                    Planlanan Tarih <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="orderDate"
                    type="datetime-local"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="orderAssignee" className="text-xs">
                    Sorumlu
                  </Label>
                  <Select
                    id="orderAssignee"
                    value={orderAssigneeId}
                    onChange={(e) => setOrderAssigneeId(e.target.value)}
                  >
                    <option value="">Seçiniz</option>
                    {technicians?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name ?? t.email}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreateOrder}
                    disabled={createOrderMutation.isPending}
                  >
                    {createOrderMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowNewOrderPanel(false);
                      setOrderError(null);
                    }}
                    disabled={createOrderMutation.isPending}
                  >
                    İptal
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">İş Emirleri</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {plan.workOrders.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Henüz iş emri oluşturulmamış.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Planlanan Tarih
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Sorumlu
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Süre
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plan.workOrders.map((wo) => (
                    <tr key={wo.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs">
                        {formatDateTime(wo.scheduledFor)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={workOrderStatusVariant(wo.status)}>
                          {workOrderStatusLabel(wo.status)}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {wo.assignee?.name ?? "—"}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {wo.actualDurationMinutes != null
                          ? `${wo.actualDurationMinutes} dk`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/is-emirleri/${wo.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
