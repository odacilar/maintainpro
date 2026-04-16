"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import {
  workOrderStatusLabel,
  workOrderStatusVariant,
  formatDateTime,
  WORK_ORDER_STATUSES,
  type WorkOrderStatus,
} from "@/lib/pm-helpers";
import type { Machine } from "@/types/machine";

interface TechnicianUser {
  id: string;
  name: string | null;
  email: string;
}

interface PmPlanRef {
  id: string;
  name: string;
}

interface WorkOrderListItem {
  id: string;
  status: string;
  scheduledFor: string;
  completedAt: string | null;
  machine: { id: string; name: string; code: string };
  assignee: { id: string; name: string | null } | null;
  pmPlan: { id: string; name: string } | null;
}

export default function IsEmirleriPage() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | "">("");
  const [filterMachine, setFilterMachine] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // New order dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [newMachineId, setNewMachineId] = useState("");
  const [newPmPlanId, setNewPmPlanId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (filterStatus) params.set("status", filterStatus);
  if (filterMachine) params.set("machineId", filterMachine);
  if (filterDateFrom) params.set("dateFrom", new Date(filterDateFrom).toISOString());
  if (filterDateTo) params.set("dateTo", new Date(filterDateTo).toISOString());

  const { data: workOrders, isLoading, isError } = useQuery<WorkOrderListItem[]>({
    queryKey: ["work-orders", filterStatus, filterMachine, filterDateFrom, filterDateTo],
    queryFn: () => fetch(`/api/work-orders?${params.toString()}`).then((r) => r.json()),
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  const { data: technicians } = useQuery<TechnicianUser[]>({
    queryKey: ["technicians"],
    queryFn: () => fetch("/api/users/technicians").then((r) => r.json()),
    enabled: showDialog,
  });

  // PM plans for selected machine in dialog
  const { data: pmPlans } = useQuery<PmPlanRef[]>({
    queryKey: ["pm-plans-for-machine", newMachineId],
    queryFn: () =>
      fetch(`/api/pm-plans?machineId=${newMachineId}`).then((r) => r.json()),
    enabled: !!newMachineId && showDialog,
  });

  const createMutation = useMutation<{ id: string }, Error, Record<string, unknown>>({
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
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      setShowDialog(false);
      resetDialog();
    },
    onError: (err) => {
      setDialogError(err.message);
    },
  });

  function resetDialog() {
    setNewMachineId("");
    setNewPmPlanId("");
    setNewDate("");
    setNewAssigneeId("");
    setNewNotes("");
    setDialogError(null);
  }

  function handleCreate() {
    if (!newMachineId) {
      setDialogError("Makine seçimi zorunludur.");
      return;
    }
    if (!newDate) {
      setDialogError("Planlanan tarih zorunludur.");
      return;
    }
    setDialogError(null);

    const payload: Record<string, unknown> = {
      machineId: newMachineId,
      scheduledDate: new Date(newDate).toISOString(),
    };
    if (newPmPlanId) payload.pmPlanId = newPmPlanId;
    if (newAssigneeId) payload.assigneeId = newAssigneeId;
    if (newNotes.trim()) payload.notes = newNotes.trim();

    createMutation.mutate(payload);
  }

  const filtered = useMemo(() => {
    return workOrders ?? [];
  }, [workOrders]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">İş Emirleri</h1>
        <Button onClick={() => { setShowDialog(true); resetDialog(); }}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni İş Emri
        </Button>
      </div>

      {/* Create dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background border shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Yeni İş Emri</h2>
              <button
                onClick={() => { setShowDialog(false); resetDialog(); }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {dialogError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
                  {dialogError}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="newMachine">
                  Makine <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="newMachine"
                  value={newMachineId}
                  onChange={(e) => { setNewMachineId(e.target.value); setNewPmPlanId(""); }}
                >
                  <option value="">Seçiniz</option>
                  {machines?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.code}
                    </option>
                  ))}
                </Select>
              </div>
              {newMachineId && (
                <div className="space-y-1.5">
                  <Label htmlFor="newPmPlan">Bakım Planı (opsiyonel)</Label>
                  <Select
                    id="newPmPlan"
                    value={newPmPlanId}
                    onChange={(e) => setNewPmPlanId(e.target.value)}
                  >
                    <option value="">Plansız (manuel)</option>
                    {pmPlans?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="newDate">
                  Planlanan Tarih <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="newDate"
                  type="datetime-local"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newAssignee">Sorumlu</Label>
                <Select
                  id="newAssignee"
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                >
                  <option value="">Seçiniz</option>
                  {technicians?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name ?? t.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newNotes">Notlar</Label>
                <textarea
                  id="newNotes"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Ek notlar..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <Button
                variant="outline"
                onClick={() => { setShowDialog(false); resetDialog(); }}
                disabled={createMutation.isPending}
              >
                İptal
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters + table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-wrap">
            <p className="text-sm font-medium flex-1">İş Emirleri</p>
            <div className="flex gap-2 flex-wrap">
              <Select
                className="w-full sm:w-44"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as WorkOrderStatus | "")}
              >
                <option value="">Tüm Durumlar</option>
                {WORK_ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {workOrderStatusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select
                className="w-full sm:w-52"
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
              >
                <option value="">Tüm Makineler</option>
                {machines?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.code}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                title="Başlangıç tarihi"
                placeholder="Başlangıç"
              />
              <Input
                type="date"
                className="w-full sm:w-40"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                title="Bitiş tarihi"
                placeholder="Bitiş"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              İş emirleri yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {workOrders?.length === 0
                ? "Henüz iş emri oluşturulmamış."
                : "Filtreyle eşleşen iş emri bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Plan Adı
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Makine
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Planlanan Tarih
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Sorumlu
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((wo) => (
                    <tr key={wo.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {wo.pmPlan?.name ?? <span className="italic">Manuel</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{wo.machine.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {wo.machine.code}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={workOrderStatusVariant(wo.status)}>
                          {workOrderStatusLabel(wo.status)}
                        </Badge>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground text-xs">
                        {formatDateTime(wo.scheduledFor)}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                        {wo.assignee?.name ?? "—"}
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
