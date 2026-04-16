import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExportColumn } from "@/lib/utils/export";

// ---------------------------------------------------------------------------
// Helpers — pure CSV builder extracted from exportToCSV logic
// These mirror the exact algorithm in export.ts without browser APIs.
// ---------------------------------------------------------------------------

function buildCsvContent(
  data: Record<string, unknown>[],
  columns: ExportColumn[]
): string {
  const BOM = "\uFEFF";
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
  return BOM + [header, ...rows].join("\r\n");
}

// ---------------------------------------------------------------------------
// CSV content generation tests
// ---------------------------------------------------------------------------

describe("CSV content generation", () => {
  const columns: ExportColumn[] = [
    { key: "code", header: "Arıza Kodu" },
    { key: "description", header: "Açıklama" },
    { key: "status", header: "Durum" },
  ];

  it("starts with UTF-8 BOM (\\uFEFF)", () => {
    const csv = buildCsvContent([], columns);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("includes quoted column headers", () => {
    const csv = buildCsvContent([], columns);
    expect(csv).toContain('"Arıza Kodu"');
    expect(csv).toContain('"Açıklama"');
    expect(csv).toContain('"Durum"');
  });

  it("uses semicolons as delimiter", () => {
    const csv = buildCsvContent([], columns);
    // After BOM, the header line should have semicolons between columns
    const firstLine = csv.slice(1).split("\r\n")[0];
    expect(firstLine).toBe('"Arıza Kodu";"Açıklama";"Durum"');
  });

  it("correctly maps column keys to row values", () => {
    const data = [
      { code: "ARZ-2026-0001", description: "Motor arızası", status: "OPEN" },
    ];
    const csv = buildCsvContent(data, columns);
    expect(csv).toContain('"ARZ-2026-0001"');
    expect(csv).toContain('"Motor arızası"');
    expect(csv).toContain('"OPEN"');
  });

  it("handles Turkish characters correctly (ş, ğ, ü, ö, ç, ı, İ)", () => {
    const data = [
      {
        code: "ARZ-2026-0002",
        description: "Şanzıman yağı sızdırıyor — İğne vana bozuldu",
        status: "ÇÖZÜLDÜ",
      },
    ];
    const csv = buildCsvContent(data, columns);
    expect(csv).toContain("Şanzıman");
    expect(csv).toContain("İğne");
    expect(csv).toContain("ÇÖZÜLDÜ");
  });

  it("escapes double quotes in values by doubling them", () => {
    const data = [
      { code: "ARZ-2026-0003", description: 'He said "OK"', status: "OPEN" },
    ];
    const csv = buildCsvContent(data, columns);
    expect(csv).toContain('"He said ""OK"""');
  });

  it("renders null / undefined values as empty quoted strings", () => {
    const data = [{ code: "ARZ-2026-0004", description: null, status: undefined }];
    const csv = buildCsvContent(data, columns);
    // null and undefined should both produce ""
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain('""');
  });

  it("outputs correct number of rows (header + data rows)", () => {
    const data = [
      { code: "ARZ-2026-0001", description: "A", status: "OPEN" },
      { code: "ARZ-2026-0002", description: "B", status: "CLOSED" },
      { code: "ARZ-2026-0003", description: "C", status: "RESOLVED" },
    ];
    const csv = buildCsvContent(data, columns);
    // Strip BOM then split
    const lines = csv.slice(1).split("\r\n");
    expect(lines.length).toBe(4); // 1 header + 3 data
  });

  it("produces empty CSV (only BOM + header) when data is empty", () => {
    const csv = buildCsvContent([], columns);
    const lines = csv.slice(1).split("\r\n");
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('"Arıza Kodu"');
  });

  it("only includes columns explicitly listed in the columns array", () => {
    const narrowColumns: ExportColumn[] = [{ key: "code", header: "Kod" }];
    const data = [
      { code: "ARZ-2026-0001", description: "gizli", status: "OPEN" },
    ];
    const csv = buildCsvContent(data, narrowColumns);
    expect(csv).toContain('"ARZ-2026-0001"');
    expect(csv).not.toContain("gizli");
    expect(csv).not.toContain("OPEN");
  });

  it("converts numeric values to string representation", () => {
    const cols: ExportColumn[] = [
      { key: "count", header: "Sayı" },
      { key: "cost", header: "Maliyet" },
    ];
    const data = [{ count: 42, cost: 1234.56 }];
    const csv = buildCsvContent(data, cols);
    expect(csv).toContain('"42"');
    expect(csv).toContain('"1234.56"');
  });

  it("uses \\r\\n as line terminator (RFC 4180)", () => {
    const data = [{ code: "ARZ-2026-0001", description: "A", status: "OPEN" }];
    const csv = buildCsvContent(data, columns);
    // Strip BOM, check raw bytes
    const body = csv.slice(1);
    expect(body.includes("\r\n")).toBe(true);
    expect(body.includes("\n\r")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// exportToCSV browser integration (mock browser APIs via globalThis patching)
// ---------------------------------------------------------------------------

describe("exportToCSV — browser integration", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let fakeLink: {
    href: string;
    download: string;
    style: { display: string };
    click: ReturnType<typeof vi.fn>;
  };
  let originalURL: typeof URL;
  let originalBlob: typeof Blob;
  let originalDocument: unknown;

  beforeEach(() => {
    clickSpy = vi.fn();
    createObjectURLSpy = vi.fn(() => "blob:http://localhost/test-url");
    revokeObjectURLSpy = vi.fn();

    fakeLink = {
      href: "",
      download: "",
      style: { display: "" },
      click: clickSpy,
    };

    // Save originals
    originalURL = globalThis.URL;
    originalBlob = globalThis.Blob;
    originalDocument = (globalThis as any).document;

    // Patch URL static methods while preserving URL as a constructor
    const PatchedURL = class extends URL {} as any;
    PatchedURL.createObjectURL = createObjectURLSpy;
    PatchedURL.revokeObjectURL = revokeObjectURLSpy;
    (globalThis as any).URL = PatchedURL;

    // Patch Blob to a minimal class (avoids needing real browser Blob)
    (globalThis as any).Blob = class MockBlob {
      constructor(
        public parts: unknown[],
        public options: unknown
      ) {}
    };

    // Patch document
    (globalThis as any).document = {
      createElement: vi.fn(() => fakeLink),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
  });

  afterEach(() => {
    // Restore originals
    (globalThis as any).URL = originalURL;
    (globalThis as any).Blob = originalBlob;
    (globalThis as any).document = originalDocument;
  });

  it("calls link.click() to trigger download", async () => {
    const { exportToCSV } = await import("@/lib/utils/export");
    const columns: ExportColumn[] = [{ key: "name", header: "İsim" }];
    exportToCSV([{ name: "Test" }], "rapor", columns);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("appends .csv extension if not present", async () => {
    const { exportToCSV } = await import("@/lib/utils/export");
    const columns: ExportColumn[] = [{ key: "name", header: "İsim" }];
    exportToCSV([{ name: "Test" }], "rapor", columns);
    expect(fakeLink.download).toBe("rapor.csv");
  });

  it("preserves .csv extension when already present", async () => {
    const { exportToCSV } = await import("@/lib/utils/export");
    const columns: ExportColumn[] = [{ key: "name", header: "İsim" }];
    exportToCSV([{ name: "Test" }], "rapor.csv", columns);
    expect(fakeLink.download).toBe("rapor.csv");
  });

  it("revokes the object URL after download", async () => {
    const { exportToCSV } = await import("@/lib/utils/export");
    const columns: ExportColumn[] = [{ key: "name", header: "İsim" }];
    exportToCSV([{ name: "Test" }], "rapor", columns);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/test-url");
  });
});
