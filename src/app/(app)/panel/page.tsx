"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Lazy-load dashboards so recharts isn't bundled into the root chunk
const AdminDashboard = dynamic(
  () => import("./_components/admin-dashboard"),
  { ssr: false, loading: () => <DashboardSkeleton /> }
);

const TechnicianDashboard = dynamic(
  () => import("./_components/technician-dashboard"),
  { ssr: false, loading: () => <DashboardSkeleton /> }
);

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-24 w-full rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function SuperAdminPanel({ name }: { name: string }) {
  return (
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Süper Admin Paneli</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">Hoşgeldiniz, {name}.</p>
          <p className="text-sm text-muted-foreground">
            Platform yönetimi, fabrika oluşturma ve abonelik işlemleri için{" "}
            <a href="/super-admin" className="text-primary hover:underline">
              Süper Admin
            </a>{" "}
            sayfasını kullanın.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PanelPage() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <DashboardSkeleton />;
  }

  const user = session?.user as
    | { name?: string | null; role?: string; factoryId?: string }
    | undefined;

  const role = user?.role;
  const name = user?.name ?? "Kullanıcı";

  if (role === "SUPER_ADMIN") {
    return <SuperAdminPanel name={name} />;
  }

  if (role === "TECHNICIAN") {
    return <TechnicianDashboard />;
  }

  if (role === "FACTORY_ADMIN" || role === "ENGINEER") {
    return <AdminDashboard />;
  }

  // Fallback — session exists but role is unknown
  return (
    <div className="py-20 text-center text-muted-foreground text-sm">
      Rol bilgisi bulunamadı. Lütfen çıkış yapıp tekrar giriş yapın.
    </div>
  );
}
