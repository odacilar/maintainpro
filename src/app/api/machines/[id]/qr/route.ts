import { NextRequest, NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { generateQRBuffer } from "@/lib/qr";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  return withApiTenant(
    {
      roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"],
    },
    async () => {
      const machine = await withFactoryTx((tx) =>
        tx.machine.findUnique({
          where: { id: params.id },
          select: { id: true, qrToken: true, code: true, name: true },
        }),
      );

      if (!machine) {
        return NextResponse.json({ error: "machine_not_found" }, { status: 404 });
      }

      const buffer = await generateQRBuffer(machine.id, machine.qrToken);

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `inline; filename="qr-${machine.code}.png"`,
          "Cache-Control": "public, max-age=86400",
        },
      });
    },
  );
}
