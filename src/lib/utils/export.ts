/**
 * Export utilities for CSV and PDF generation.
 * Turkish character support is handled via BOM (CSV) and standard Latin fonts (PDF).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportColumn {
  key: string;
  header: string;
  /** PDF column width in points (optional) */
  width?: number;
}

export interface PdfExportConfig {
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, unknown>[];
  filename: string;
  /** Optional date range label shown in the header, e.g. "01.04.2026 – 13.04.2026" */
  dateRange?: string;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

/**
 * Serialises data to a CSV string and triggers a browser download.
 * A UTF-8 BOM is prepended so Excel opens Turkish characters correctly.
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: ExportColumn[]
): void {
  const header = columns.map((c) => `"${c.header}"`).join(";");

  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key];
        if (value === null || value === undefined) return '""';
        const str = String(value).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(";")
  );

  // UTF-8 BOM (\uFEFF) makes Excel detect encoding correctly
  const csvContent = "\uFEFF" + [header, ...rows].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

/**
 * Creates a PDF report using jsPDF + autoTable and triggers a browser download.
 * Uses Helvetica (built-in jsPDF font) which covers Latin Extended / Turkish
 * characters on most PDF viewers when the file is UTF-8.
 */
export async function exportToPDF(config: PdfExportConfig): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const {
    title,
    subtitle,
    columns,
    data,
    filename,
    dateRange,
  } = config;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;

  // ── Header ─────────────────────────────────────────────────────────────────
  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175); // blue-800
  doc.text("MaintainPro", marginX, 36);

  // Report title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39); // gray-900
  doc.text(title, marginX, 56);

  // Subtitle / date range
  let headerBottom = 56;
  if (subtitle || dateRange) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128); // gray-500
    const subLine = [subtitle, dateRange].filter(Boolean).join("   |   ");
    doc.text(subLine, marginX, 70);
    headerBottom = 70;
  }

  // Divider
  doc.setDrawColor(209, 213, 219); // gray-300
  doc.setLineWidth(0.5);
  doc.line(marginX, headerBottom + 8, pageWidth - marginX, headerBottom + 8);

  // Generation timestamp (top-right)
  const generatedAt = new Date().toLocaleString("tr-TR");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text(`Oluşturuldu: ${generatedAt}`, pageWidth - marginX, 36, { align: "right" });

  // ── Table ──────────────────────────────────────────────────────────────────
  const tableColumns = columns.map((col) => ({
    header: col.header,
    dataKey: col.key,
  }));

  const tableRows = data.map((row) =>
    Object.fromEntries(
      columns.map((col) => {
        const val = row[col.key];
        return [col.key, val === null || val === undefined ? "—" : String(val)];
      })
    )
  );

  // Column widths (optional)
  const columnStyles: Record<string, { cellWidth?: number }> = {};
  columns.forEach((col) => {
    if (col.width) columnStyles[col.key] = { cellWidth: col.width };
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).autoTable({
    columns: tableColumns,
    body: tableRows,
    startY: headerBottom + 16,
    margin: { left: marginX, right: marginX },
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 5,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [30, 64, 175], // blue-800
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251], // gray-50
    },
    columnStyles,
    didDrawPage: (hookData: { pageNumber: number }) => {
      // Footer on each page
      const pageNum = hookData.pageNumber;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalPages = (doc as any).internal.getNumberOfPages();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Sayfa ${pageNum} / ${totalPages}`,
        pageWidth / 2,
        pageHeight - 16,
        { align: "center" }
      );
      doc.text(
        "MaintainPro — Gizli",
        marginX,
        pageHeight - 16
      );
    },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
