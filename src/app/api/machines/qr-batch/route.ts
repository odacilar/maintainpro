import { NextResponse } from "next/server";
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";
import { generateQRDataURL } from "@/lib/qr";
import { jsPDF } from "jspdf";

export async function GET() {
  return withApiTenant(
    { roles: ["FACTORY_ADMIN", "ENGINEER"] },
    async () => {
      const machines = await withFactoryTx((tx) =>
        tx.machine.findMany({
          select: { id: true, code: true, name: true, qrToken: true },
          orderBy: { code: "asc" },
        }),
      );

      if (machines.length === 0) {
        return NextResponse.json({ error: "no_machines" }, { status: 404 });
      }

      const COLS = 3;
      const ROWS = 4;
      const PER_PAGE = COLS * ROWS;
      const CELL_W = 60;
      const CELL_H = 65;
      const QR_SIZE = 35;
      const MARGIN_X = 15;
      const MARGIN_Y = 15;

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      for (let i = 0; i < machines.length; i++) {
        if (i > 0 && i % PER_PAGE === 0) doc.addPage();

        const posInPage = i % PER_PAGE;
        const col = posInPage % COLS;
        const row = Math.floor(posInPage / COLS);
        const x = MARGIN_X + col * CELL_W;
        const y = MARGIN_Y + row * CELL_H;

        const dataUrl = await generateQRDataURL(machines[i].id, machines[i].qrToken);
        doc.addImage(dataUrl, "PNG", x + (CELL_W - QR_SIZE) / 2, y, QR_SIZE, QR_SIZE);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(machines[i].code, x + CELL_W / 2, y + QR_SIZE + 4, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const name = machines[i].name.length > 25 ? machines[i].name.slice(0, 24) + "…" : machines[i].name;
        doc.text(name, x + CELL_W / 2, y + QR_SIZE + 8, { align: "center" });
      }

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="makineler-qr.pdf"',
        },
      });
    },
  );
}
