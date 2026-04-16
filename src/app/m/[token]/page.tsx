import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { unsafePrisma } from "@/lib/tenant/prisma";

interface QRScanPageProps {
  params: { token: string };
}

/**
 * QR scan entry point. The qrToken is globally unique across all tenants, so
 * we use unsafePrisma here intentionally — this is one of the rare valid cases
 * where a cross-tenant lookup is required. After finding the machine, the user
 * is redirected to the tenant-scoped detail page (/makineler/[id]) which
 * enforces normal RLS-backed access control.
 */
export default async function QRScanPage({ params }: QRScanPageProps) {
  const session = await auth();

  if (!session?.user) {
    const callbackUrl = encodeURIComponent(`/m/${params.token}`);
    redirect(`/giris?callbackUrl=${callbackUrl}`);
  }

  const machine = await unsafePrisma.machine.findUnique({
    where: { qrToken: params.token },
    select: { id: true },
  });

  if (!machine) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            Makine bulunamadı
          </h1>
          <p className="mt-2 text-muted-foreground">
            Bu QR koda ait makine sistemde kayıtlı değil.
          </p>
        </div>
      </div>
    );
  }

  redirect(`/arizalar/yeni?machineId=${machine.id}`);
}
