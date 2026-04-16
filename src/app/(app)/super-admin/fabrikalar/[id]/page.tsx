"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Edit, Users, Wrench, HardDrive, CreditCard } from "lucide-react";

interface FactoryDetail {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL";
  plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  createdAt: string;
  subscription: {
    id: string;
    plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
    status: "ACTIVE" | "CANCELLED" | "PAST_DUE";
    currentPeriodEnd: string | null;
    monthlyPrice: number;
  } | null;
}

interface FactoryLimits {
  users: { current: number; limit: number | null };
  machines: { current: number; limit: number | null };
  storageGb: { current: number; limit: number | null };
}

type Plan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

const planLabels: Record<Plan, string> = {
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

const planPrices: Record<Plan, number> = {
  STARTER: 99,
  PROFESSIONAL: 199,
  ENTERPRISE: 399,
};

function planBadge(plan: Plan) {
  switch (plan) {
    case "STARTER":
      return <Badge variant="secondary">Starter</Badge>;
    case "PROFESSIONAL":
      return <Badge variant="warning">Professional</Badge>;
    case "ENTERPRISE":
      return <Badge variant="success">Enterprise</Badge>;
  }
}

function statusBadge(status: FactoryDetail["status"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="success">Aktif</Badge>;
    case "SUSPENDED":
      return <Badge variant="danger">Askıya Alındı</Badge>;
    case "TRIAL":
      return <Badge variant="secondary">Deneme</Badge>;
  }
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

function UsageBar({ label, current, limit, icon: Icon }: {
  label: string;
  current: number;
  limit: number | null;
  icon: React.ElementType;
}) {
  const pct = limit ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </div>
        <span className="font-medium">
          {current}
          {limit !== null ? ` / ${limit}` : " / Sınırsız"}
        </span>
      </div>
      {limit !== null && (
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className={`h-2 rounded-full transition-all ${
              isCritical
                ? "bg-destructive"
                : isWarning
                ? "bg-yellow-500"
                : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function FabrikaDetayPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>("STARTER");
  const [planError, setPlanError] = useState<string | null>(null);

  const { data: factory, isLoading, isError } = useQuery<FactoryDetail>({
    queryKey: ["admin-factories", id],
    queryFn: () => fetch(`/api/admin/factories/${id}`).then((r) => r.json()),
  });

  const { data: limits } = useQuery<FactoryLimits>({
    queryKey: ["admin-factories", id, "limits"],
    queryFn: () => fetch(`/api/admin/factories/${id}/check-limits`).then((r) => r.json()),
    enabled: !!factory,
  });

  const planMutation = useMutation({
    mutationFn: (plan: Plan) =>
      fetch(`/api/admin/factories/${id}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Plan güncellenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factories", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-factories"] });
      setShowPlanDialog(false);
      setPlanError(null);
    },
    onError: (err: Error) => {
      setPlanError(err.message);
    },
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !factory) {
    return <div className="py-20 text-center text-destructive text-sm">Fabrika bulunamadı.</div>;
  }

  function openPlanDialog() {
    setSelectedPlan((factory?.plan ?? "STARTER") as Plan);
    setPlanError(null);
    setShowPlanDialog(true);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/super-admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Yönetim Paneli
        </Link>
        <h1 className="text-2xl font-semibold flex-1">{factory.name}</h1>
        <Link
          href={`/super-admin/fabrikalar/${id}/duzenle`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Edit className="h-4 w-4 mr-1" />
          Düzenle
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Factory Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Fabrika Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FieldRow label="Fabrika Adı" value={factory.name} />
              <FieldRow label="Slug" value={<span className="font-mono text-xs">{factory.slug}</span>} />
              <FieldRow label="Şehir" value={factory.city} />
              <FieldRow label="Telefon" value={factory.phone} />
              <FieldRow label="Durum" value={statusBadge(factory.status)} />
              <FieldRow label="Plan" value={planBadge(factory.plan)} />
              <FieldRow
                label="Kayıt Tarihi"
                value={new Date(factory.createdAt).toLocaleDateString("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>
            {factory.address && (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Adres</p>
                <p className="text-sm whitespace-pre-wrap">{factory.address}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Abonelik
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {factory.subscription ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan</span>
                    {planBadge(factory.subscription.plan)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aylık Ücret</span>
                    <span className="text-sm font-semibold">${planPrices[factory.subscription.plan]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Durum</span>
                    <Badge
                      variant={
                        factory.subscription.status === "ACTIVE"
                          ? "success"
                          : factory.subscription.status === "PAST_DUE"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {factory.subscription.status === "ACTIVE"
                        ? "Aktif"
                        : factory.subscription.status === "PAST_DUE"
                        ? "Ödeme Gecikmiş"
                        : "İptal Edildi"}
                    </Badge>
                  </div>
                  {factory.subscription.currentPeriodEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Bitiş</span>
                      <span className="text-sm">
                        {new Date(factory.subscription.currentPeriodEnd).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={openPlanDialog}>
                  Plan Değiştir
                </Button>
              </>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">Aktif abonelik yok.</p>
                <Button size="sm" className="w-full" onClick={openPlanDialog}>
                  Abonelik Başlat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Limits */}
      {limits && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kullanım Durumu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label="Kullanıcılar"
              current={limits.users.current}
              limit={limits.users.limit}
              icon={Users}
            />
            <UsageBar
              label="Makineler"
              current={limits.machines.current}
              limit={limits.machines.limit}
              icon={Wrench}
            />
            <UsageBar
              label="Depolama"
              current={limits.storageGb.current}
              limit={limits.storageGb.limit}
              icon={HardDrive}
            />
          </CardContent>
        </Card>
      )}

      {/* Plan Change Dialog */}
      {showPlanDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg border p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">Plan Değiştir</h2>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium">{factory.name}</span> için yeni plan seçin.
            </p>

            <div className="space-y-3 mb-6">
              {(["STARTER", "PROFESSIONAL", "ENTERPRISE"] as Plan[]).map((plan) => (
                <label
                  key={plan}
                  className={`flex items-center justify-between rounded-md border p-3 cursor-pointer transition-colors ${
                    selectedPlan === plan
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="plan"
                      value={plan}
                      checked={selectedPlan === plan}
                      onChange={() => setSelectedPlan(plan)}
                      className="accent-primary"
                    />
                    <div>
                      <div className="font-medium text-sm">{planLabels[plan]}</div>
                      <div className="text-xs text-muted-foreground">
                        {plan === "STARTER" && "5 kullanıcı / 20 makine / 5 GB"}
                        {plan === "PROFESSIONAL" && "15 kullanıcı / 50 makine / 20 GB"}
                        {plan === "ENTERPRISE" && "Sınırsız kullanıcı / 100 makine / 100 GB"}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">${planPrices[plan]}/ay</span>
                </label>
              ))}
            </div>

            {planError && (
              <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                {planError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowPlanDialog(false)}
                disabled={planMutation.isPending}
              >
                İptal
              </Button>
              <Button
                onClick={() => planMutation.mutate(selectedPlan)}
                disabled={planMutation.isPending || selectedPlan === factory.plan}
              >
                {planMutation.isPending ? "Güncelleniyor..." : "Planı Uygula"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
