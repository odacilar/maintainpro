"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, BarChart2, ClipboardList, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "@/components/charts";
import {
  statusLabel,
  priorityLabel,
  typeLabel,
  formatDateTime,
  formatDowntime,
  BREAKDOWN_STATUSES,
  BREAKDOWN_PRIORITIES,
} from "@/lib/breakdown-helpers";
import {
  stockStatusLabel,
  categoryLabel,
  unitLabel,
  formatCurrency,
} from "@/lib/spare-part-helpers";
import { exportToCSV, exportToPDF } from "@/lib/utils/export";
import type { BreakdownListItem, BreakdownStatus, BreakdownPriority } from "@/types/breakdown";
import type { SparePartListItem } from "@/types/spare-part";

// ─── Date range helpers ───────────────────────────────────────────────────────

type DateRangePreset = "7" | "30" | "90";

function presetToDates(preset: DateRangePreset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - parseInt(preset, 10));
  return { from, to };
}

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDateTR(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Shared Types ─────────────────────────────────────────────────────────────

interface MttrDataPoint { date: string; avgMinutes: number }
interface MtbfDataPoint { week: string; avgHours: number }
interface ParetoItem { machineCode: string; machineName: string; count: number }
interface DeptDowntimeItem { department: string; totalMinutes: number }
interface ChecklistRecord {
  id: string;
  status: string;
  scheduledFor: string;
  completedAt?: string | null;
  template: { id: string; name: string };
  machine: { id: string; name: string; code: string };
  user?: { id: string; name: string | null } | null;
}
interface Action {
  id: string;
  code: string;
  status: string;
  priority: string;
  description: string;
  createdAt: string;
  machine?: { name: string; code: string } | null;
}
interface SparePartAlert {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
}
interface CostSummary {
  totalCost: number;
  previousPeriodCost: number;
  changePercent: number;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = "arizalar" | "stok" | "performans" | "checklist";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "arizalar", label: "Arıza Raporu", icon: <FileText className="h-4 w-4" /> },
  { id: "stok", label: "Stok Raporu", icon: <Package className="h-4 w-4" /> },
  { id: "performans", label: "Bakım Performansı", icon: <BarChart2 className="h-4 w-4" /> },
  { id: "checklist", label: "Checklist Uyum", icon: <ClipboardList className="h-4 w-4" /> },
];

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-muted animate-pulse ${className}`} />;
}

// ─── Tab 1: Arıza Raporu ──────────────────────────────────────────────────────

function ArizaRaporu() {
  const [preset, setPreset] = useState<DateRangePreset>("30");
  const [filterStatus, setFilterStatus] = useState<BreakdownStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<BreakdownPriority | "">("");

  const { from, to } = presetToDates(preset);
  const dateRangeLabel = `${formatDateTR(from)} – ${formatDateTR(to)}`;

  const { data: breakdowns = [], isLoading } = useQuery<BreakdownListItem[]>({
    queryKey: ["breakdowns"],
    queryFn: () => fetch("/api/breakdowns").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    const fromTs = from.getTime();
    const toTs = to.getTime();
    return breakdowns
      .filter((b) => {
        const ts = new Date(b.reportedAt).getTime();
        const inRange = ts >= fromTs && ts <= toTs;
        const matchStatus = !filterStatus || b.status === filterStatus;
        const matchPriority = !filterPriority || b.priority === filterPriority;
        return inRange && matchStatus && matchPriority;
      })
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [breakdowns, from, to, filterStatus, filterPriority]);

  // KPIs
  const totalCount = filtered.length;
  const resolved = filtered.filter((b) => b.status === "RESOLVED" || b.status === "CLOSED");
  // BreakdownListItem does not include resolvedAt; use downtimeMinutes when available via cast
  type BreakdownListItemExt = BreakdownListItem & { resolvedAt?: string | null; downtimeMinutes?: number | null };
  const avgResolution =
    resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, b) => {
            const ext = b as BreakdownListItemExt;
            if (ext.downtimeMinutes != null) return sum + ext.downtimeMinutes;
            const start = new Date(b.reportedAt).getTime();
            const end = ext.resolvedAt ? new Date(ext.resolvedAt).getTime() : Date.now();
            return sum + (end - start) / 60000;
          }, 0) / resolved.length
        )
      : 0;

  const machineCounts: Record<string, { name: string; count: number }> = {};
  filtered.forEach((b) => {
    const key = b.machine.code;
    machineCounts[key] = {
      name: b.machine.name,
      count: (machineCounts[key]?.count ?? 0) + 1,
    };
  });
  const topMachine = Object.entries(machineCounts).sort((a, b) => b[1].count - a[1].count)[0];

  const csvColumns = [
    { key: "code", header: "Arıza No" },
    { key: "machineName", header: "Makine" },
    { key: "machineCode", header: "Makine Kodu" },
    { key: "type", header: "Tip" },
    { key: "priority", header: "Öncelik" },
    { key: "status", header: "Durum" },
    { key: "reportedAt", header: "Bildirim Tarihi" },
    { key: "resolutionTime", header: "Çözüm Süresi" },
    { key: "reporter", header: "Bildiren" },
  ];

  function buildExportRows() {
    type BreakdownListItemExt2 = BreakdownListItem & { resolvedAt?: string | null; downtimeMinutes?: number | null };
    return filtered.map((b) => {
      const ext = b as BreakdownListItemExt2;
      const minutes = ext.downtimeMinutes ?? null;
      return {
        code: b.code,
        machineName: b.machine.name,
        machineCode: b.machine.code,
        type: typeLabel(b.type),
        priority: priorityLabel(b.priority),
        status: statusLabel(b.status),
        reportedAt: formatDateTime(b.reportedAt),
        resolutionTime: minutes !== null ? formatDowntime(minutes) : "—",
        reporter: b.reporter.name ?? b.reporter.email,
      };
    });
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          className="w-36"
          value={preset}
          onChange={(e) => setPreset(e.target.value as DateRangePreset)}
        >
          <option value="7">Son 7 Gün</option>
          <option value="30">Son 30 Gün</option>
          <option value="90">Son 90 Gün</option>
        </Select>
        <Select
          className="w-44"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as BreakdownStatus | "")}
        >
          <option value="">Tüm Durumlar</option>
          {BREAKDOWN_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </Select>
        <Select
          className="w-40"
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as BreakdownPriority | "")}
        >
          <option value="">Tüm Öncelikler</option>
          {BREAKDOWN_PRIORITIES.map((p) => (
            <option key={p} value={p}>{priorityLabel(p)}</option>
          ))}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(buildExportRows(), `arizalar-${toISODate(from)}-${toISODate(to)}`, csvColumns)}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSV İndir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToPDF({
                title: "Arıza Raporu",
                subtitle: "Tüm arıza kayıtları",
                dateRange: dateRangeLabel,
                columns: csvColumns,
                data: buildExportRows(),
                filename: `arizalar-${toISODate(from)}-${toISODate(to)}`,
              })
            }
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            PDF İndir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Toplam Arıza</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{isLoading ? "—" : totalCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Ort. Çözüm Süresi</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{isLoading ? "—" : formatDowntime(avgResolution)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">En Çok Arıza</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold truncate">{isLoading ? "—" : (topMachine ? topMachine[1].name : "—")}</p>
            {topMachine && (
              <p className="text-xs text-muted-foreground">{topMachine[1].count} arıza</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Bu tarih aralığında arıza kaydı bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Arıza No</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Makine</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Tip</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Öncelik</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Bildirim</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Çözüm Süresi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    type BExt = BreakdownListItem & { downtimeMinutes?: number | null };
                    const minutes = (b as BExt).downtimeMinutes ?? null;
                    return (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{b.code}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{b.machine.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{b.machine.code}</div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{typeLabel(b.type)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={b.priority === "CRITICAL" ? "danger" : b.priority === "HIGH" ? "warning" : "default"}>
                            {priorityLabel(b.priority)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={b.status === "CLOSED" || b.status === "RESOLVED" ? "success" : b.status === "OPEN" ? "danger" : "default"}>
                            {statusLabel(b.status)}
                          </Badge>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs">{formatDateTime(b.reportedAt)}</td>
                        <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground text-xs">
                          {minutes !== null ? formatDowntime(minutes) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 2: Stok Raporu ───────────────────────────────────────────────────────

function StokRaporu() {
  const { data: spareParts = [], isLoading: loadingParts } = useQuery<SparePartListItem[]>({
    queryKey: ["spare-parts"],
    queryFn: () => fetch("/api/spare-parts").then((r) => r.json()),
  });

  const { data: costData } = useQuery<CostSummary>({
    queryKey: ["dashboard", "costs"],
    queryFn: () => fetch("/api/dashboard/costs?days=30").then((r) => r.json()),
  });

  const { data: alertsRaw } = useQuery<{ data: SparePartAlert[] } | SparePartAlert[]>({
    queryKey: ["spare-parts", "alerts"],
    queryFn: () => fetch("/api/spare-parts/alerts").then((r) => r.json()),
  });
  const alerts: SparePartAlert[] = Array.isArray(alertsRaw)
    ? alertsRaw
    : (alertsRaw as { data: SparePartAlert[] })?.data ?? [];

  const csvColumns = [
    { key: "code", header: "Parça Kodu" },
    { key: "name", header: "Parça Adı" },
    { key: "category", header: "Kategori" },
    { key: "currentStock", header: "Mevcut Stok" },
    { key: "minimumStock", header: "Minimum Stok" },
    { key: "unit", header: "Birim" },
    { key: "unitPrice", header: "Birim Fiyat (TL)" },
    { key: "status", header: "Durum" },
  ];

  function buildExportRows() {
    return spareParts.map((p) => ({
      code: p.code,
      name: p.name,
      category: categoryLabel(p.category),
      currentStock: p.currentStock,
      minimumStock: p.minimumStock,
      unit: unitLabel(p.unit),
      unitPrice: p.unitPrice != null ? p.unitPrice : "",
      status: stockStatusLabel(p.currentStock, p.minimumStock),
    }));
  }

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(buildExportRows(), `stok-raporu-${toISODate(new Date())}`, csvColumns)}
          disabled={spareParts.length === 0}
        >
          <Download className="h-4 w-4 mr-1.5" />
          CSV İndir
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            exportToPDF({
              title: "Stok Raporu",
              subtitle: "Mevcut stok seviyeleri",
              dateRange: formatDateTR(new Date()),
              columns: csvColumns,
              data: buildExportRows(),
              filename: `stok-raporu-${toISODate(new Date())}`,
            })
          }
          disabled={spareParts.length === 0}
        >
          <Download className="h-4 w-4 mr-1.5" />
          PDF İndir
        </Button>
      </div>

      {/* Cost summary */}
      {costData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium">Son 30 Gün Maliyet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(costData.totalCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium">Önceki Dönem</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(costData.previousPeriodCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground font-medium">Değişim</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${costData.changePercent > 0 ? "text-red-600" : "text-green-600"}`}>
                {costData.changePercent > 0 ? "+" : ""}{costData.changePercent.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Low stock alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-amber-600">
              Kritik Stok Uyarıları ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-amber-50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parça Kodu</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parça Adı</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mevcut</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Minimum</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Birim</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                      <td className="px-4 py-3 font-medium">{a.name}</td>
                      <td className="px-4 py-3 font-bold text-red-600">{a.currentStock}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.minimumStock}</td>
                      <td className="px-4 py-3 text-muted-foreground">{unitLabel(a.unit)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={a.currentStock === 0 ? "destructive" : "danger"}>
                          {a.currentStock === 0 ? "Tükendi" : "Düşük Stok"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full stock table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Tüm Stok</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingParts ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : spareParts.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Stok verisi bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parça Kodu</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Parça Adı</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Kategori</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mevcut Stok</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Min. Stok</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Birim</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Fiyat</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {spareParts.map((p) => (
                    <tr key={p.id} className={`border-b last:border-0 hover:bg-muted/30 ${p.currentStock <= p.minimumStock ? "bg-amber-50/50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{p.code}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{categoryLabel(p.category)}</td>
                      <td className="px-4 py-3 font-medium">{p.currentStock}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">{p.minimumStock}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">{unitLabel(p.unit)}</td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                        {p.unitPrice != null ? formatCurrency(p.unitPrice) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.currentStock === 0 ? "destructive" : p.currentStock <= p.minimumStock ? "danger" : "success"}>
                          {stockStatusLabel(p.currentStock, p.minimumStock)}
                        </Badge>
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

// ─── Tab 3: Bakım Performansı ─────────────────────────────────────────────────

function BakimPerformans() {
  const [days, setDays] = useState("30");

  const { data: mttrRaw, isLoading: loadingMttr } = useQuery<{ averageMinutes: number; trend: MttrDataPoint[] }>({
    queryKey: ["dashboard", "mttr", days],
    queryFn: () => fetch(`/api/dashboard/mttr?days=${days}`).then((r) => r.json()),
  });

  const { data: mtbfRaw, isLoading: loadingMtbf } = useQuery<{ averageHours: number; trend: MtbfDataPoint[] }>({
    queryKey: ["dashboard", "mtbf", days],
    queryFn: () => fetch(`/api/dashboard/mtbf?days=${days}`).then((r) => r.json()),
  });

  const { data: paretoRaw, isLoading: loadingPareto } = useQuery<{ data: ParetoItem[] }>({
    queryKey: ["dashboard", "pareto", days],
    queryFn: () => fetch(`/api/dashboard/pareto?days=${days}`).then((r) => r.json()),
  });

  const { data: deptRaw, isLoading: loadingDept } = useQuery<{ data: DeptDowntimeItem[] }>({
    queryKey: ["dashboard", "department-downtime", days],
    queryFn: () => fetch(`/api/dashboard/department-downtime?days=${days}`).then((r) => r.json()),
  });

  const mttrTrend = mttrRaw?.trend ?? [];
  const mtbfTrend = mtbfRaw?.trend ?? [];
  const paretoData = paretoRaw?.data ?? [];
  const deptDowntime = deptRaw?.data ?? [];

  const formatDateShort = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });

  function exportPerformansPDF() {
    const paretoRows = paretoData.map((p) => ({
      machineCode: p.machineCode,
      machineName: p.machineName,
      count: p.count,
    }));
    exportToPDF({
      title: "Bakım Performans Raporu",
      subtitle: `Son ${days} gün`,
      dateRange: formatDateTR(new Date()),
      columns: [
        { key: "machineCode", header: "Makine Kodu" },
        { key: "machineName", header: "Makine Adı" },
        { key: "count", header: "Arıza Sayısı" },
      ],
      data: paretoRows,
      filename: `performans-raporu-${toISODate(new Date())}`,
    });
  }

  function exportPerformansCSV() {
    const deptRows = deptDowntime.map((d) => ({
      department: d.department,
      totalHours: (d.totalMinutes / 60).toFixed(1),
      totalMinutes: d.totalMinutes,
    }));
    exportToCSV(deptRows, `departman-durus-${toISODate(new Date())}`, [
      { key: "department", header: "Departman" },
      { key: "totalHours", header: "Toplam Duruş (sa)" },
      { key: "totalMinutes", header: "Toplam Duruş (dk)" },
    ]);
  }

  const deptChartData = deptDowntime.map((d) => ({
    ...d,
    totalHours: parseFloat((d.totalMinutes / 60).toFixed(1)),
  }));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select className="w-36" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="7">Son 7 Gün</option>
          <option value="30">Son 30 Gün</option>
          <option value="90">Son 90 Gün</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPerformansCSV} disabled={deptDowntime.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            CSV İndir
          </Button>
          <Button variant="outline" size="sm" onClick={exportPerformansPDF} disabled={paretoData.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            PDF İndir
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Ortalama MTTR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loadingMttr ? "—" : formatDowntime(Math.round(mttrRaw?.averageMinutes ?? 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Ortalama MTBF</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {loadingMtbf ? "—" : `${(mtbfRaw?.averageHours ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sa`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">MTTR Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMttr ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={208}>
                <LineChart data={mttrTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} dk`} />
                  <Tooltip labelFormatter={(l) => formatDateShort(String(l))} formatter={(v) => [`${Math.round(Number(v))} dk`, "MTTR"]} />
                  <Line type="monotone" dataKey="avgMinutes" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">MTBF Trendi (Haftalık)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMtbf ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={208}>
                <LineChart data={mtbfTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} sa`} />
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString("tr-TR")} sa`, "MTBF"]} />
                  <Line type="monotone" dataKey="avgHours" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Arıza Pareto (İlk 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPareto ? <Skeleton className="h-60 w-full" /> : paretoData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">Veri yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={paretoData.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="machineCode" tick={{ fontSize: 11 }} width={64} />
                  <Tooltip formatter={(v, _n, p) => [`${v} arıza`, (p as { payload?: ParetoItem }).payload?.machineName ?? ""]} />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Departman Duruş (sa)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDept ? <Skeleton className="h-60 w-full" /> : deptChartData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">Veri yok</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={deptChartData} margin={{ top: 0, right: 10, left: -10, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} sa`} />
                  <Tooltip formatter={(v) => [`${v} saat`, "Toplam Duruş"]} />
                  <Bar dataKey="totalHours" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab 4: Checklist Uyum Raporu ─────────────────────────────────────────────

function ChecklistUyum() {
  const [preset, setPreset] = useState<DateRangePreset>("30");
  const { from, to } = presetToDates(preset);

  const { data: records = [], isLoading: loadingRecords } = useQuery<ChecklistRecord[]>({
    queryKey: ["checklist-records", "report", preset],
    queryFn: () =>
      fetch(`/api/checklists/records?from=${toISODate(from)}&to=${toISODate(to)}`).then((r) => r.json()),
  });

  const { data: actionsRaw, isLoading: loadingActions } = useQuery<{ data: Action[] } | Action[]>({
    queryKey: ["actions", "report"],
    queryFn: () => fetch("/api/actions").then((r) => r.json()),
  });
  const actions: Action[] = Array.isArray(actionsRaw)
    ? actionsRaw
    : (actionsRaw as { data: Action[] })?.data ?? [];

  // Stats
  const total = records.length;
  const completed = records.filter((r) => r.status === "COMPLETED").length;
  const missed = records.filter((r) => r.status === "MISSED").length;
  const complianceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const csvColumns = [
    { key: "templateName", header: "Şablon" },
    { key: "machineName", header: "Makine" },
    { key: "machineCode", header: "Makine Kodu" },
    { key: "scheduledFor", header: "Planlanan Tarih" },
    { key: "status", header: "Durum" },
    { key: "completedAt", header: "Tamamlanma Tarihi" },
    { key: "assignedTo", header: "Atanan Kişi" },
  ];

  const STATUS_LABELS: Record<string, string> = {
    PENDING: "Bekliyor",
    IN_PROGRESS: "Devam Ediyor",
    COMPLETED: "Tamamlandı",
    MISSED: "Kaçırıldı",
  };

  function buildExportRows() {
    return records.map((r) => ({
      templateName: r.template.name,
      machineName: r.machine.name,
      machineCode: r.machine.code,
      scheduledFor: formatDateTime(r.scheduledFor),
      status: STATUS_LABELS[r.status] ?? r.status,
      completedAt: r.completedAt ? formatDateTime(r.completedAt) : "—",
      assignedTo: r.user?.name ?? "—",
    }));
  }

  const dateRangeLabel = `${formatDateTR(from)} – ${formatDateTR(to)}`;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select className="w-36" value={preset} onChange={(e) => setPreset(e.target.value as DateRangePreset)}>
          <option value="7">Son 7 Gün</option>
          <option value="30">Son 30 Gün</option>
          <option value="90">Son 90 Gün</option>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(buildExportRows(), `checklist-uyum-${toISODate(from)}-${toISODate(to)}`, csvColumns)}
            disabled={records.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSV İndir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToPDF({
                title: "Checklist Uyum Raporu",
                subtitle: "Otonom bakım kontrol tamamlanma oranları",
                dateRange: dateRangeLabel,
                columns: csvColumns,
                data: buildExportRows(),
                filename: `checklist-uyum-${toISODate(from)}-${toISODate(to)}`,
              })
            }
            disabled={records.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            PDF İndir
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Toplam Kontrol</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{loadingRecords ? "—" : total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Tamamlanan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{loadingRecords ? "—" : completed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Kaçırılan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">{loadingRecords ? "—" : missed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground font-medium">Uyum Oranı</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${complianceRate >= 80 ? "text-green-600" : complianceRate >= 50 ? "text-amber-600" : "text-red-600"}`}>
              %{loadingRecords ? "—" : complianceRate}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance bar */}
      {!loadingRecords && total > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Uyum Oranı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-1 text-sm">
              <span>%{complianceRate}</span>
              <span className="text-muted-foreground">{completed} / {total} tamamlandı</span>
            </div>
            <div className="h-4 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${complianceRate >= 80 ? "bg-green-500" : complianceRate >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${complianceRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions from abnormal items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Anormal Kalemlerden Oluşan Aksiyonlar
            {!loadingActions && <span className="ml-2 text-sm font-normal text-muted-foreground">({actions.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingActions ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : actions.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Açık aksiyon yok.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Aksiyon No</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Açıklama</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Makine</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Öncelik</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.slice(0, 20).map((a) => (
                    <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{a.code}</td>
                      <td className="px-4 py-3 text-sm max-w-xs truncate">{a.description}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground text-xs">
                        {a.machine ? `${a.machine.name} (${a.machine.code})` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={a.priority === "HIGH" ? "warning" : a.priority === "CRITICAL" ? "danger" : "default"}>
                          {priorityLabel(a.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={a.status === "COMPLETED" || a.status === "VERIFIED" ? "success" : a.status === "OPEN" ? "danger" : "default"}>
                          {a.status === "OPEN" ? "Açık" : a.status === "IN_PROGRESS" ? "Devam Ediyor" : a.status === "COMPLETED" ? "Tamamlandı" : a.status === "VERIFIED" ? "Doğrulandı" : a.status}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs">{formatDateTime(a.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist records table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Kontrol Listesi Kayıtları</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRecords ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">Bu dönemde kayıt bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Şablon</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Makine</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Planlanan</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Atanan</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{r.template.name}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.machine.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.machine.code}</div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs">{formatDateTime(r.scheduledFor)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.status === "COMPLETED" ? "success" : r.status === "MISSED" ? "danger" : r.status === "IN_PROGRESS" ? "default" : "secondary"}>
                          {STATUS_LABELS[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">{r.user?.name ?? "—"}</td>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RaporlarPage() {
  const [activeTab, setActiveTab] = useState<Tab>("arizalar");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Raporlar</h1>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div>
        {activeTab === "arizalar" && <ArizaRaporu />}
        {activeTab === "stok" && <StokRaporu />}
        {activeTab === "performans" && <BakimPerformans />}
        {activeTab === "checklist" && <ChecklistUyum />}
      </div>
    </div>
  );
}
