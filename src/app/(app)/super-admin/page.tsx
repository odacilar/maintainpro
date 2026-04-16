"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Users, Wrench, CreditCard, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface AdminStats {
  totalFactories: number;
  totalUsers: number;
  totalMachines: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

interface FactoryRow {
  id: string;
  name: string;
  slug: string;
  plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE";
  userCount: number;
  machineCount: number;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL";
}

function planBadge(plan: FactoryRow["plan"]) {
  switch (plan) {
    case "STARTER":
      return <Badge variant="secondary">Starter</Badge>;
    case "PROFESSIONAL":
      return <Badge variant="warning">Professional</Badge>;
    case "ENTERPRISE":
      return <Badge variant="success">Enterprise</Badge>;
  }
}

function statusBadge(status: FactoryRow["status"]) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="success">Aktif</Badge>;
    case "SUSPENDED":
      return <Badge variant="danger">Askıya Alındı</Badge>;
    case "TRIAL":
      return <Badge variant="secondary">Deneme</Badge>;
  }
}

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
              {suffix && <span className="text-base font-normal text-muted-foreground ml-1">{suffix}</span>}
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

export default function SuperAdminPage() {
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => fetch("/api/admin/stats").then((r) => r.json()),
  });

  const { data: factories, isLoading: factoriesLoading, isError } = useQuery<FactoryRow[]>({
    queryKey: ["admin-factories"],
    queryFn: () => fetch("/api/admin/factories").then((r) => r.json()),
  });

  const filtered = factories?.filter((f) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.slug.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Yönetim Paneli</h1>
          <p className="text-sm text-muted-foreground mt-1">Platform geneli istatistikler ve fabrika yönetimi</p>
        </div>
        <Link href="/super-admin/fabrikalar/yeni" className={buttonVariants()}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Fabrika
        </Link>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Toplam Fabrika" value={stats?.totalFactories ?? 0} icon={Building2} />
          <StatCard label="Toplam Kullanıcı" value={stats?.totalUsers ?? 0} icon={Users} />
          <StatCard label="Toplam Makine" value={stats?.totalMachines ?? 0} icon={Wrench} />
          <StatCard label="Aktif Abonelik" value={stats?.activeSubscriptions ?? 0} icon={CreditCard} />
          <StatCard
            label="Aylık Gelir"
            value={stats ? `$${stats.monthlyRevenue.toLocaleString()}` : "$0"}
            icon={TrendingUp}
          />
        </div>
      )}

      {/* Factories Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Fabrikalar</CardTitle>
            <input
              type="text"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full sm:w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {factoriesLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Fabrikalar yüklenemedi.
            </div>
          )}
          {!factoriesLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {factories?.length === 0
                ? "Henüz fabrika eklenmemiş."
                : "Filtreyle eşleşen fabrika bulunamadı."}
            </div>
          )}
          {!factoriesLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fabrika Adı</th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Plan</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Kullanıcılar</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">Makineler</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Durum</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((factory) => (
                    <tr key={factory.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{factory.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{factory.slug}</div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3">{planBadge(factory.plan)}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{factory.userCount}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">{factory.machineCount}</td>
                      <td className="px-4 py-3">{statusBadge(factory.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/super-admin/fabrikalar/${factory.id}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Detay
                          </Link>
                          <Link
                            href={`/super-admin/fabrikalar/${factory.id}/duzenle`}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            Düzenle
                          </Link>
                        </div>
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
