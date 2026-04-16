"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { CreditCard, TrendingUp, Building2, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SubscriptionPlan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
type SubscriptionStatus = "active" | "cancelled" | "past_due";

interface FactorySubscription {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    userLimit: number;
    machineLimit: number;
    storageLimitGb: number;
    currentPeriodEnd: string;
  } | null;
  _count: {
    users: number;
    machines: number;
  };
}

// ---------------------------------------------------------------------------
// Plan configuration
// ---------------------------------------------------------------------------

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  STARTER: 99,
  PROFESSIONAL: 199,
  ENTERPRISE: 399,
};

function planLabel(plan: SubscriptionPlan) {
  switch (plan) {
    case "STARTER":
      return "Starter";
    case "PROFESSIONAL":
      return "Professional";
    case "ENTERPRISE":
      return "Enterprise";
  }
}

function planBadge(plan: SubscriptionPlan) {
  switch (plan) {
    case "STARTER":
      return <Badge variant="secondary">Starter</Badge>;
    case "PROFESSIONAL":
      return <Badge variant="default" className="bg-purple-600 text-white border-transparent">Professional</Badge>;
    case "ENTERPRISE":
      return <Badge variant="warning" className="bg-amber-400 text-amber-900 border-transparent">Enterprise</Badge>;
  }
}

function statusBadge(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return <Badge variant="success">Aktif</Badge>;
    case "cancelled":
      return <Badge variant="danger">İptal</Badge>;
    case "past_due":
      return <Badge variant="warning">Gecikmiş</Badge>;
  }
}


// ---------------------------------------------------------------------------
// Inline Modal
// ---------------------------------------------------------------------------

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg bg-background shadow-xl border border-border mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  suffix,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">
              {value}
              {suffix && (
                <span className="text-base font-normal text-muted-foreground ml-1">
                  {suffix}
                </span>
              )}
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AboneliklerPage() {
  const queryClient = useQueryClient();

  const [planDialog, setPlanDialog] = useState<FactorySubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>("STARTER");
  const [planError, setPlanError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  const { data: factories, isLoading, isError } = useQuery<FactorySubscription[]>({
    queryKey: ["admin-factories"],
    queryFn: () => fetch("/api/admin/factories").then((r) => r.json()),
  });

  // ---------------------------------------------------------------------------
  // Summary stats
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    if (!factories) return null;
    const active = factories.filter((f) => f.subscription?.status === "active");
    const revenue = active.reduce((sum, f) => {
      if (!f.subscription) return sum;
      return sum + (PLAN_PRICES[f.subscription.plan] ?? 0);
    }, 0);
    const planCount: Record<SubscriptionPlan, number> = {
      STARTER: 0,
      PROFESSIONAL: 0,
      ENTERPRISE: 0,
    };
    active.forEach((f) => {
      if (f.subscription) planCount[f.subscription.plan]++;
    });
    return { activeCount: active.length, revenue, planCount };
  }, [factories]);

  // ---------------------------------------------------------------------------
  // Mutation: change plan
  // ---------------------------------------------------------------------------

  const changePlanMutation = useMutation({
    mutationFn: ({ factoryId, plan }: { factoryId: string; plan: SubscriptionPlan }) =>
      fetch(`/api/admin/factories/${factoryId}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((body as { error?: string }).error ?? "Plan değiştirilemedi.");
        return body;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factories"] });
      setPlanDialog(null);
      setPlanError(null);
    },
    onError: (err: Error) => setPlanError(err.message),
  });

  function openPlanDialog(factory: FactorySubscription) {
    setPlanDialog(factory);
    setSelectedPlan(factory.subscription?.plan ?? "STARTER");
    setPlanError(null);
  }

  function handleChangePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planDialog) return;
    changePlanMutation.mutate({ factoryId: planDialog.id, plan: selectedPlan });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Abonelikler</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fabrika aboneliklerini ve plan dağılımını yönetin
        </p>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Toplam Aktif Abonelik"
            value={stats?.activeCount ?? 0}
            icon={CreditCard}
          />
          <StatCard
            label="Aylık Toplam Gelir"
            value={stats ? `$${stats.revenue.toLocaleString("tr-TR")}` : "$0"}
            icon={TrendingUp}
          />
          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Plan Dağılımı</p>
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary">Starter</Badge>
                      <span className="font-semibold">{stats?.planCount.STARTER ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="default" className="bg-purple-600 text-white border-transparent">Professional</Badge>
                      <span className="font-semibold">{stats?.planCount.PROFESSIONAL ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="warning" className="bg-amber-400 text-amber-900 border-transparent">Enterprise</Badge>
                      <span className="font-semibold">{stats?.planCount.ENTERPRISE ?? 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Fabrika Abonelikleri</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Abonelikler yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && (!factories || factories.length === 0) && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Henüz fabrika kaydı yok.
            </div>
          )}
          {!isLoading && !isError && factories && factories.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fabrika Adı</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcı Limiti</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Makine Limiti</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Depolama</th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Aylık Ücret</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {factories.map((factory) => {
                    const sub = factory.subscription;
                    return (
                      <tr key={factory.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{factory.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{factory.slug}</div>
                        </td>
                        <td className="px-4 py-3">
                          {sub ? planBadge(sub.plan) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {sub ? statusBadge(sub.status) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                          {sub ? (
                            <span>
                              <span className="font-medium text-foreground">{factory._count.users}</span>
                              {" / "}{sub.userLimit === 999 ? "∞" : sub.userLimit}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                          {sub ? (
                            <span>
                              <span className="font-medium text-foreground">{factory._count.machines}</span>
                              {" / "}{sub.machineLimit}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                          {sub ? `${sub.storageLimitGb} GB` : "—"}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 font-medium">
                          {sub ? `$${PLAN_PRICES[sub.plan]}` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/super-admin/fabrikalar/${factory.id}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              Detay
                            </Link>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openPlanDialog(factory)}
                            >
                              Plan Değiştir
                            </Button>
                          </div>
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

      {/* Plan Change Modal */}
      <Modal
        open={!!planDialog}
        onClose={() => { setPlanDialog(null); setPlanError(null); }}
        title="Plan Değiştir"
      >
        {planDialog && (
          <form onSubmit={handleChangePlan} className="space-y-4">
            <div className="space-y-1 pb-3 border-b border-border">
              <p className="text-xs text-muted-foreground">Fabrika</p>
              <p className="font-medium">{planDialog.name}</p>
              {planDialog.subscription && (
                <p className="text-xs text-muted-foreground">
                  Mevcut plan: {planLabel(planDialog.subscription.plan)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-select">
                Yeni Plan
              </label>
              <Select
                id="plan-select"
                className="w-full"
                value={selectedPlan}
                onChange={(e) => setSelectedPlan(e.target.value as SubscriptionPlan)}
              >
                <option value="STARTER">Starter — $99/ay (5 kullanıcı, 20 makine, 5 GB)</option>
                <option value="PROFESSIONAL">Professional — $199/ay (15 kullanıcı, 50 makine, 20 GB)</option>
                <option value="ENTERPRISE">Enterprise — $399/ay (Sınırsız kullanıcı, 100 makine, 100 GB)</option>
              </Select>
            </div>
            {planError && <p className="text-sm text-destructive">{planError}</p>}
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={changePlanMutation.isPending} className="flex-1">
                {changePlanMutation.isPending ? "Değiştiriliyor..." : "Planı Değiştir"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setPlanDialog(null); setPlanError(null); }}
              >
                İptal
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
