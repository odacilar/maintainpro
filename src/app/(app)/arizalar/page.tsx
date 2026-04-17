"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Plus, Search, Download, CheckSquare, X } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/utils/export";
import {
  statusLabel,
  statusVariant,
  priorityLabel,
  priorityVariant,
  typeLabel,
  formatDateTime,
  BREAKDOWN_STATUSES,
  BREAKDOWN_PRIORITIES,
} from "@/lib/breakdown-helpers";
import type { BreakdownListItem, BreakdownStatus, BreakdownPriority } from "@/types/breakdown";

// ---------------------------------------------------------------------------
// Assign dialog — simple inline modal (no external Dialog component available)
// ---------------------------------------------------------------------------

interface AssignDialogProps {
  selectedCount: number;
  onConfirm: (assigneeId: string) => void;
  onClose: () => void;
}

interface Technician {
  id: string;
  name: string | null;
  email: string;
}

function AssignDialog({ selectedCount, onConfirm, onClose }: AssignDialogProps) {
  const [assigneeId, setAssigneeId] = useState("");

  const { data: technicians, isLoading } = useQuery<Technician[]>({
    queryKey: ["technicians"],
    queryFn: () => fetch("/api/users/technicians").then((r) => r.json()),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 w-full max-w-sm mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Toplu Ata</h2>
          <button onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          {selectedCount} arıza seçildi. Atanacak teknisyeni seçin:
        </p>

        <Select
          className="w-full"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          disabled={isLoading}
        >
          <option value="">Teknisyen seçin...</option>
          {technicians?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name ?? t.email}
            </option>
          ))}
        </Select>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            İptal
          </Button>
          <Button
            size="sm"
            disabled={!assigneeId}
            onClick={() => {
              if (assigneeId) onConfirm(assigneeId);
            }}
          >
            Ata
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ArizalarPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<BreakdownStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<BreakdownPriority | "">("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data: breakdowns, isLoading, isError } = useQuery<BreakdownListItem[]>({
    queryKey: ["breakdowns"],
    queryFn: () => fetch("/api/breakdowns").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    if (!breakdowns) return [];
    return [...breakdowns]
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .filter((b) => {
        const matchSearch =
          !search ||
          b.code.toLowerCase().includes(search.toLowerCase()) ||
          b.description.toLowerCase().includes(search.toLowerCase()) ||
          b.machine.name.toLowerCase().includes(search.toLowerCase());
        const matchStatus = !filterStatus || b.status === filterStatus;
        const matchPriority = !filterPriority || b.priority === filterPriority;
        return matchSearch && matchStatus && matchPriority;
      });
  }, [breakdowns, search, filterStatus, filterPriority]);

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const allFilteredIds = filtered.map((b) => b.id);
  const allSelected =
    filtered.length > 0 && filtered.every((b) => selectedIds.has(b.id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBulkMessage(null);
  }

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  async function handleBulkClose() {
    setBulkLoading(true);
    setBulkMessage(null);
    try {
      const res = await fetch("/api/breakdowns/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", ids: Array.from(selectedIds) }),
      });
      const data = (await res.json()) as { success: number; failed: number; errors: { id: string; reason: string }[] };
      await queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
      setSelectedIds(new Set());
      if (data.failed === 0) {
        setBulkMessage({ type: "success", text: `${data.success} arıza başarıyla kapatıldı.` });
      } else {
        setBulkMessage({
          type: "error",
          text: `${data.success} arıza kapatıldı, ${data.failed} arıza kapatılamadı.`,
        });
      }
    } catch {
      setBulkMessage({ type: "error", text: "İşlem sırasında bir hata oluştu." });
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkAssign(assigneeId: string) {
    setShowAssignDialog(false);
    setBulkLoading(true);
    setBulkMessage(null);
    try {
      const res = await fetch("/api/breakdowns/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign", ids: Array.from(selectedIds), assigneeId }),
      });
      const data = (await res.json()) as { success: number; failed: number; errors: { id: string; reason: string }[] };
      await queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
      setSelectedIds(new Set());
      if (data.failed === 0) {
        setBulkMessage({ type: "success", text: `${data.success} arıza başarıyla atandı.` });
      } else {
        setBulkMessage({
          type: "error",
          text: `${data.success} arıza atandı, ${data.failed} arıza atanamadı.`,
        });
      }
    } catch {
      setBulkMessage({ type: "error", text: "İşlem sırasında bir hata oluştu." });
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Arızalar</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCSV(
                filtered.map((b) => ({
                  code: b.code,
                  machineName: b.machine.name,
                  machineCode: b.machine.code,
                  type: typeLabel(b.type),
                  priority: priorityLabel(b.priority),
                  status: statusLabel(b.status),
                  reporter: b.reporter.name ?? b.reporter.email,
                  reportedAt: formatDateTime(b.reportedAt),
                })),
                "arizalar",
                [
                  { key: "code", header: "Arıza No" },
                  { key: "machineName", header: "Makine" },
                  { key: "machineCode", header: "Makine Kodu" },
                  { key: "type", header: "Tip" },
                  { key: "priority", header: "Öncelik" },
                  { key: "status", header: "Durum" },
                  { key: "reporter", header: "Bildiren" },
                  { key: "reportedAt", header: "Bildirim Tarihi" },
                ]
              )
            }
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">CSV İndir</span>
          </Button>
          <Link href="/arizalar/yeni" className={buttonVariants()}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Arıza Bildir</span>
          </Link>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg flex-wrap">
          <CheckSquare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} seçili
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading}
              onClick={handleBulkClose}
            >
              Toplu Kapat
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulkLoading}
              onClick={() => setShowAssignDialog(true)}
            >
              Toplu Ata
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="h-4 w-4" />
              <span className="sr-only">Seçimi temizle</span>
            </Button>
          </div>
        </div>
      )}

      {/* Feedback message */}
      {bulkMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            bulkMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {bulkMessage.text}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Arıza no, açıklama veya makine ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                className="w-full sm:w-48"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as BreakdownStatus | "")}
              >
                <option value="">Tüm Durumlar</option>
                {BREAKDOWN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select
                className="w-full sm:w-40"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as BreakdownPriority | "")}
              >
                <option value="">Tüm Öncelikler</option>
                {BREAKDOWN_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Arızalar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {breakdowns?.length === 0
                ? "Henüz arıza kaydı oluşturulmamış."
                : "Filtreyle eşleşen arıza bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {/* Select-all checkbox */}
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input cursor-pointer"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Tümünü seç"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Arıza No
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Makine
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Tip
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Öncelik
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Bildiren
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Tarih
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((breakdown) => (
                    <tr
                      key={breakdown.id}
                      className={`border-b last:border-0 hover:bg-muted/30 ${
                        selectedIds.has(breakdown.id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input cursor-pointer"
                          checked={selectedIds.has(breakdown.id)}
                          onChange={() => toggleOne(breakdown.id)}
                          aria-label={`${breakdown.code} seç`}
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {breakdown.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{breakdown.machine.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {breakdown.machine.code}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {typeLabel(breakdown.type)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityVariant(breakdown.priority)}>
                          {priorityLabel(breakdown.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant(breakdown.status)}>
                          {statusLabel(breakdown.status)}
                        </Badge>
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                        {breakdown.reporter.name ?? breakdown.reporter.email}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs">
                        {formatDateTime(breakdown.reportedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/arizalar/${breakdown.id}`}
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

      {/* Assign dialog */}
      {showAssignDialog && (
        <AssignDialog
          selectedCount={selectedIds.size}
          onConfirm={handleBulkAssign}
          onClose={() => setShowAssignDialog(false)}
        />
      )}
    </div>
  );
}
