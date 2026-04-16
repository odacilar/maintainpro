"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "TRANSITION" | "LOGIN" | "EXPORT";

interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  entityName: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

interface PaginatedResponse {
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Oluşturma",
  UPDATE: "Güncelleme",
  DELETE: "Silme",
  TRANSITION: "Durum Değişimi",
  LOGIN: "Giriş",
  EXPORT: "Dışa Aktarma",
};

const ACTION_VARIANTS: Record<AuditAction, string> = {
  CREATE: "bg-green-100 text-green-800 border-transparent",
  UPDATE: "bg-blue-100 text-blue-800 border-transparent",
  DELETE: "bg-red-100 text-red-800 border-transparent",
  TRANSITION: "bg-purple-100 text-purple-800 border-transparent",
  LOGIN: "bg-gray-100 text-gray-700 border-transparent",
  EXPORT: "bg-orange-100 text-orange-800 border-transparent",
};

const ENTITY_LABELS: Record<string, string> = {
  machine: "Makine",
  breakdown: "Arıza",
  spare_part: "Yedek Parça",
  checklist: "Otonom Bakım",
  action: "Aksiyon",
  work_order: "İş Emri",
  user: "Kullanıcı",
  pm_plan: "Planlı Bakım",
};

const ACTION_OPTIONS: Array<{ value: AuditAction | ""; label: string }> = [
  { value: "", label: "Tüm İşlemler" },
  { value: "CREATE", label: "Oluşturma" },
  { value: "UPDATE", label: "Güncelleme" },
  { value: "DELETE", label: "Silme" },
  { value: "TRANSITION", label: "Durum Değişimi" },
  { value: "LOGIN", label: "Giriş" },
  { value: "EXPORT", label: "Dışa Aktarma" },
];

const ENTITY_OPTIONS = [
  { value: "", label: "Tüm Kayıtlar" },
  { value: "machine", label: "Makine" },
  { value: "breakdown", label: "Arıza" },
  { value: "spare_part", label: "Yedek Parça" },
  { value: "checklist", label: "Otonom Bakım" },
  { value: "action", label: "Aksiyon" },
  { value: "work_order", label: "İş Emri" },
  { value: "user", label: "Kullanıcı" },
  { value: "pm_plan", label: "Planlı Bakım" },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// Expandable row component
// ---------------------------------------------------------------------------

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = log.action === "UPDATE" && log.changes && Object.keys(log.changes).length > 0;

  return (
    <>
      <tr className="border-b border-border hover:bg-muted/40 transition-colors">
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {formatDateTime(log.createdAt)}
        </td>
        <td className="px-4 py-3 text-sm">
          {log.user ? (
            <div>
              <div className="font-medium">{log.user.name}</div>
              <div className="text-xs text-muted-foreground">{log.user.email}</div>
            </div>
          ) : (
            <span className="text-muted-foreground">Sistem</span>
          )}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border",
              ACTION_VARIANTS[log.action],
            )}
          >
            {ACTION_LABELS[log.action]}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          {ENTITY_LABELS[log.entityType] ?? log.entityType}
        </td>
        <td className="px-4 py-3 text-sm font-medium">
          {log.entityName ?? log.entityId ?? "—"}
        </td>
        <td className="px-4 py-3 text-sm">
          {hasChanges ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-primary hover:underline text-xs"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {Object.keys(log.changes!).length} alan
            </button>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
      </tr>

      {expanded && hasChanges && (
        <tr className="bg-muted/20">
          <td colSpan={6} className="px-8 py-3">
            <div className="rounded-md border border-border overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Alan</th>
                    <th className="px-3 py-2 text-left font-medium">Eski Değer</th>
                    <th className="px-3 py-2 text-left font-medium">Yeni Değer</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(log.changes!).map(([field, { old: oldVal, new: newVal }]) => (
                    <tr key={field} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{field}</td>
                      <td className="px-3 py-2 text-red-600 line-through">{formatValue(oldVal)}</td>
                      <td className="px-3 py-2 text-green-700">{formatValue(newVal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DenetimKayitlariPage() {
  const [filterAction, setFilterAction] = useState<AuditAction | "">("");
  const [filterEntityType, setFilterEntityType] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  const queryParams = new URLSearchParams();
  if (filterAction) queryParams.set("action", filterAction);
  if (filterEntityType) queryParams.set("entityType", filterEntityType);
  if (filterUserId) queryParams.set("userId", filterUserId);
  if (filterStartDate) queryParams.set("startDate", filterStartDate);
  if (filterEndDate) queryParams.set("endDate", filterEndDate);
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));

  const { data, isLoading, isError } = useQuery<PaginatedResponse>({
    queryKey: ["audit-logs", filterAction, filterEntityType, filterUserId, filterStartDate, filterEndDate, page],
    queryFn: () => fetch(`/api/audit-logs?${queryParams.toString()}`).then((r) => r.json()),
  });

  function resetFilters() {
    setFilterAction("");
    setFilterEntityType("");
    setFilterUserId("");
    setFilterStartDate("");
    setFilterEndDate("");
    setPage(1);
  }

  const { data: logs = [], pagination } = data ?? { data: [], pagination: undefined };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Denetim Kayıtları</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fabrika kapsamındaki tüm önemli işlemlerin tarihçesi
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Başlangıç Tarihi</label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Bitiş Tarihi</label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setPage(1); }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">İşlem Tipi</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value as AuditAction | ""); setPage(1); }}
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Kayıt Tipi</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={filterEntityType}
                onChange={(e) => { setFilterEntityType(e.target.value); setPage(1); }}
              >
                {ENTITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters} className="w-full">
                Sıfırla
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 text-center text-muted-foreground">Yükleniyor…</div>
          ) : isError ? (
            <div className="py-20 text-center text-destructive">Kayıtlar yüklenemedi.</div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              Seçili filtreler için kayıt bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">İşlem</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kayıt Tipi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kayıt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detaylar</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <AuditRow key={log.id} log={log} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Toplam {pagination.total} kayıt — Sayfa {pagination.page} / {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
            >
              Sonraki
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
