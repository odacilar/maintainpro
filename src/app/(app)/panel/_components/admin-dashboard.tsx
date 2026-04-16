"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "@/components/charts";
import { formatCurrency } from "@/lib/spare-part-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardSummary {
  activeBreakdowns: number;
  resolvedToday: number;
  machineStatus: Record<string, number>;
  openActions: number;
  lowStockParts: number;
  checklistComplianceToday: { completed: number; total: number; rate: number };
}

interface CostSummary {
  totalCost: number;
  previousPeriodCost: number;
  changePercent: number;
}

interface MttrDataPoint {
  date: string;
  avgMinutes: number;
}

interface ParetoItem {
  machineCode: string;
  machineName: string;
  count: number;
}

interface DepartmentDowntimeItem {
  department: string;
  totalMinutes: number;
}

interface SparePartAlert {
  id: string;
  name: string;
  code: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
}

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

function SkeletonChart({ height = 220 }: { height?: number }) {
  return (
    <div
      className="w-full rounded-md bg-muted animate-pulse"
      style={{ height }}
    />
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  valueColor,
  sub,
}: {
  title: string;
  value: React.ReactNode;
  valueColor?: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className={`text-3xl font-bold tracking-tight ${valueColor ?? ""}`}>{value}</p>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ─── Machine Status Donut ─────────────────────────────────────────────────────

const MACHINE_STATUS_COLORS: Record<string, string> = {
  RUNNING: "#22c55e",
  BROKEN: "#ef4444",
  MAINTENANCE: "#f59e0b",
  DECOMMISSIONED: "#9ca3af",
};

const MACHINE_STATUS_LABELS: Record<string, string> = {
  RUNNING: "Çalışıyor",
  BROKEN: "Arızalı",
  MAINTENANCE: "Bakımda",
  DECOMMISSIONED: "Devre Dışı",
};

function MachineStatusChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(counts)
    .map(([status, value]) => ({
      name: MACHINE_STATUS_LABELS[status] ?? status,
      value,
      color: MACHINE_STATUS_COLORS[status] ?? "#9ca3af",
    }))
    .filter((d) => d.value > 0);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="relative flex items-center justify-center">
      <PieChart width={200} height={200}>
        <Pie
          data={data}
          cx={100}
          cy={100}
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [value, ""]}
        />
      </PieChart>
      {/* Centre label */}
      <div className="absolute flex flex-col items-center pointer-events-none">
        <span className="text-2xl font-bold">{total}</span>
        <span className="text-xs text-muted-foreground">Makine</span>
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: summary, isLoading: loadingSummary } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => fetch("/api/dashboard/summary").then((r) => r.json()),
    refetchInterval: 60_000,
  });

  const { data: costData } = useQuery<CostSummary>({
    queryKey: ["dashboard", "costs"],
    queryFn: () => fetch("/api/dashboard/costs?days=30").then((r) => r.json()),
  });

  const { data: mttrRaw, isLoading: loadingMttr } = useQuery<{ averageMinutes: number; trend: MttrDataPoint[] }>({
    queryKey: ["dashboard", "mttr"],
    queryFn: () => fetch("/api/dashboard/mttr?days=30").then((r) => r.json()),
  });
  const mttrTrend: MttrDataPoint[] = mttrRaw?.trend ?? [];

  const { data: paretoRaw, isLoading: loadingPareto } = useQuery<{ data: ParetoItem[] }>({
    queryKey: ["dashboard", "pareto"],
    queryFn: () => fetch("/api/dashboard/pareto?days=30").then((r) => r.json()),
  });
  const paretoData: ParetoItem[] = paretoRaw?.data ?? [];

  const { data: deptRaw, isLoading: loadingDept } = useQuery<{ data: DepartmentDowntimeItem[] }>({
    queryKey: ["dashboard", "department-downtime"],
    queryFn: () => fetch("/api/dashboard/department-downtime?days=30").then((r) => r.json()),
  });
  const deptDowntime: DepartmentDowntimeItem[] = deptRaw?.data ?? [];

  const { data: alertsRaw, isLoading: loadingAlerts } = useQuery<{ data: SparePartAlert[] } | SparePartAlert[]>({
    queryKey: ["spare-parts", "alerts"],
    queryFn: () => fetch("/api/spare-parts/alerts").then((r) => r.json()),
  });

  // Normalise: API may return { data: [...] } or [...]
  const alerts: SparePartAlert[] = Array.isArray(alertsRaw)
    ? alertsRaw
    : (alertsRaw as { data: SparePartAlert[] })?.data ?? [];

  // ── Derived values ──────────────────────────────────────────────────────────

  const avgMttr = mttrRaw?.averageMinutes ?? 0;

  const costChangeAbs = costData ? Math.abs(costData.changePercent) : 0;
  const costChangeDir = costData ? (costData.changePercent <= 0 ? "down" : "up") : "flat";

  const formatMinutes = (min: number) => {
    if (min < 60) return `${Math.round(min)} dk`;
    return `${(min / 60).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sa`;
  };

  const formatDateShort = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });

  const deptChartData = (deptDowntime ?? []).map((d) => ({
    ...d,
    totalHours: parseFloat((d.totalMinutes / 60).toFixed(1)),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Pano</h1>
        <span className="text-xs text-muted-foreground">Son 30 Gün</span>
      </div>

      {/* ── Row 1: KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingSummary ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KpiCard
              title="Aktif Arızalar"
              value={summary?.activeBreakdowns ?? 0}
              valueColor={
                (summary?.activeBreakdowns ?? 0) > 0 ? "text-red-600" : "text-green-600"
              }
              sub={
                (summary?.activeBreakdowns ?? 0) > 0
                  ? "Açık müdahale gerektiriyor"
                  : "Tüm arızalar çözüldü"
              }
            />

            <KpiCard
              title="Bugün Çözülen"
              value={summary?.resolvedToday ?? 0}
              valueColor="text-green-600"
              sub="arıza kapatıldı"
            />

            <KpiCard
              title="Ortalama Onarım Süresi (MTTR)"
              value={formatMinutes(avgMttr)}
              sub="Son 30 günlük ortalama"
            />

            <KpiCard
              title="Yedek Parça Maliyeti"
              value={formatCurrency(costData?.totalCost ?? 0)}
              sub={
                <span className="flex items-center gap-1">
                  {costChangeDir === "down" ? (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">
                      ↓ %{costChangeAbs.toFixed(1)}
                    </Badge>
                  ) : costChangeDir === "up" ? (
                    <Badge variant="danger" className="text-[10px] px-1.5 py-0">
                      ↑ %{costChangeAbs.toFixed(1)}
                    </Badge>
                  ) : null}
                  <span>önceki döneme göre</span>
                </span>
              }
            />
          </>
        )}
      </div>

      {/* ── Row 2: MTTR Trend + Makine Durumu ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* MTTR Trend Line Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">MTTR Trendi (Son 30 Gün)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMttr ? (
              <SkeletonChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={mttrTrend ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mttrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateShort}
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v} dk`}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatDateShort(String(label))}
                    formatter={(value) => [`${Math.round(Number(value))} dk`, "Ort. MTTR"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgMinutes"
                    name="Ort. MTTR"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Makine Durumu Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Makine Durumu</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {loadingSummary ? (
              <SkeletonChart height={200} />
            ) : (
              <>
                <MachineStatusChart
                  counts={
                    (summary?.machineStatus as DashboardSummary["machineStatus"]) ?? {
                      RUNNING: 0,
                      BROKEN: 0,
                      MAINTENANCE: 0,
                      DECOMMISSIONED: 0,
                    }
                  }
                />
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                  {Object.entries(MACHINE_STATUS_LABELS).map(([key, label]) => (
                    <span key={key} className="flex items-center gap-1">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: MACHINE_STATUS_COLORS[key] }}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Pareto + Departman Duruş ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Arıza Pareto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Arıza Pareto — En Sık 10 Makine</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPareto ? (
              <SkeletonChart height={240} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={(paretoData ?? []).slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="machineCode"
                    tick={{ fontSize: 11 }}
                    width={64}
                  />
                  <Tooltip
                    formatter={(value, _name, props) => [
                      `${value} arıza`,
                      (props as { payload?: ParetoItem }).payload?.machineName ?? "",
                    ]}
                  />
                  <Bar dataKey="count" name="Arıza Sayısı" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Departman Duruş */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Departman Duruş (sa)</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDept ? (
              <SkeletonChart height={240} />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={deptChartData}
                  margin={{ top: 0, right: 10, left: -10, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="department"
                    tick={{ fontSize: 11 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} sa`} />
                  <Tooltip formatter={(value) => [`${value} saat`, "Toplam Duruş"]} />
                  <Bar dataKey="totalHours" name="Duruş (sa)" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Kritik Stok + Bakım Uyumu ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Kritik Stok Uyarıları */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Kritik Stok Uyarıları</CardTitle>
            <Link
              href="/parcalar?belowMinimum=true"
              className="text-xs text-primary hover:underline"
            >
              Tümünü Gör
            </Link>
          </CardHeader>
          <CardContent>
            {loadingAlerts ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-10 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Kritik stok uyarısı yok.
              </p>
            ) : (
              <ul className="space-y-2">
                {alerts.slice(0, 5).map((part) => (
                  <li
                    key={part.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{part.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{part.code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {part.currentStock} / {part.minimumStock} {part.unit}
                      </span>
                      <Badge variant={part.currentStock === 0 ? "destructive" : "danger"}>
                        {part.currentStock === 0 ? "Tükendi" : "Düşük"}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Otonom Bakım Uyumu + Açık Aksiyonlar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Otonom Bakım & Aksiyonlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingSummary ? (
              <div className="space-y-3">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-3 w-full rounded-full bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                {/* Compliance progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Otonom Bakım Uyumu</span>
                    <span
                      className={
                        (summary?.checklistComplianceToday?.rate ?? 0) >= 80
                          ? "text-green-600 font-semibold"
                          : (summary?.checklistComplianceToday?.rate ?? 0) >= 50
                          ? "text-amber-600 font-semibold"
                          : "text-red-600 font-semibold"
                      }
                    >
                      %{Math.round(summary?.checklistComplianceToday?.rate ?? 0)}
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        (summary?.checklistComplianceToday?.rate ?? 0) >= 80
                          ? "bg-green-500"
                          : (summary?.checklistComplianceToday?.rate ?? 0) >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${summary?.checklistComplianceToday?.rate ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Son 30 günlük kontrol tamamlanma oranı</p>
                </div>

                {/* Open actions */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-medium">Açık Aksiyonlar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {summary?.openActions ?? 0}
                    </span>
                    <Link href="/aksiyonlar">
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        Görüntüle
                      </Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
