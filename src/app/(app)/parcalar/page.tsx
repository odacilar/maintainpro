"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Plus, Search, Download, X, Trash2 } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/utils/export";
import {
  stockStatusLabel,
  stockStatusVariant,
  categoryLabel,
  unitLabel,
  formatCurrency,
  SPARE_PART_CATEGORIES,
} from "@/lib/spare-part-helpers";
import { StockAlerts } from "./_components/stock-alerts";
import type { SparePartListItem, SparePartCategory } from "@/types/spare-part";

// ---------------------------------------------------------------------------
// Bulk stock entry dialog
// ---------------------------------------------------------------------------

interface BulkMovementRow {
  id: number;
  sparePartId: string;
  quantity: string;
  unitPrice: string;
  note: string;
}

interface BulkStockDialogProps {
  spareParts: SparePartListItem[];
  onClose: () => void;
  onSuccess: (created: number) => void;
}

let nextRowId = 1;

function BulkStockDialog({ spareParts, onClose, onSuccess }: BulkStockDialogProps) {
  const [rows, setRows] = useState<BulkMovementRow[]>([
    { id: nextRowId++, sparePartId: "", quantity: "", unitPrice: "", note: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: nextRowId++, sparePartId: "", quantity: "", unitPrice: "", note: "" },
    ]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: keyof Omit<BulkMovementRow, "id">, value: string) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  async function handleSubmit() {
    setError(null);

    const validRows = rows.filter((r) => r.sparePartId && r.quantity);
    if (validRows.length === 0) {
      setError("En az bir satır doldurun.");
      return;
    }

    const movements = validRows.map((r) => ({
      sparePartId: r.sparePartId,
      quantity: parseInt(r.quantity, 10),
      unitPrice: r.unitPrice ? parseFloat(r.unitPrice) : undefined,
      note: r.note || undefined,
    }));

    const invalidQty = movements.find((m) => isNaN(m.quantity) || m.quantity <= 0);
    if (invalidQty) {
      setError("Miktar değerleri pozitif tam sayı olmalıdır.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/spare-parts/bulk-movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "IN", movements }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Bir hata oluştu.");
        return;
      }

      const data = (await res.json()) as { created: number; failed: number };
      onSuccess(data.created);
    } catch {
      setError("Sunucu bağlantı hatası.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 w-full max-w-3xl mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Toplu Stok Girişi</h2>
          <button onClick={onClose} aria-label="Kapat" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Birden fazla parça için aynı anda stok girişi yapabilirsiniz (Alış — PURCHASE_IN).
        </p>

        {/* Row table */}
        <div className="space-y-2">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
            <span>Parça</span>
            <span>Miktar</span>
            <span>Birim Fiyat (TL)</span>
            <span>Not</span>
            <span />
          </div>

          {rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] gap-2 items-start"
            >
              <Select
                className="w-full"
                value={row.sparePartId}
                onChange={(e) => updateRow(row.id, "sparePartId", e.target.value)}
              >
                <option value="">Parça seçin...</option>
                {spareParts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
              <Input
                type="number"
                min={1}
                placeholder="Miktar"
                value={row.quantity}
                onChange={(e) => updateRow(row.id, "quantity", e.target.value)}
              />
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Fiyat"
                value={row.unitPrice}
                onChange={(e) => updateRow(row.id, "unitPrice", e.target.value)}
              />
              <Input
                placeholder="Not (isteğe bağlı)"
                value={row.note}
                onChange={(e) => updateRow(row.id, "note", e.target.value)}
              />
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                aria-label="Satırı sil"
                className="mt-1 sm:mt-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRow} type="button">
          <Plus className="h-4 w-4 mr-1.5" />
          Satır Ekle
        </Button>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            İptal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ParcalarPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<SparePartCategory | "">("");
  const [onlyBelowMin, setOnlyBelowMin] = useState(false);
  const [showBulkStockDialog, setShowBulkStockDialog] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: spareParts, isLoading, isError } = useQuery<SparePartListItem[]>({
    queryKey: ["spare-parts"],
    queryFn: () => fetch("/api/spare-parts").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    if (!spareParts) return [];
    return spareParts.filter((p) => {
      const matchSearch =
        !search ||
        p.code.toLowerCase().includes(search.toLowerCase()) ||
        p.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !filterCategory || p.category === filterCategory;
      const matchBelowMin = !onlyBelowMin || p.currentStock <= p.minimumStock;
      return matchSearch && matchCategory && matchBelowMin;
    });
  }, [spareParts, search, filterCategory, onlyBelowMin]);

  function handleBulkStockSuccess(created: number) {
    setShowBulkStockDialog(false);
    queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
    setBulkMessage({
      type: "success",
      text: `${created} stok hareketi başarıyla kaydedildi.`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Yedek Parçalar</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCSV(
                filtered.map((p) => ({
                  code: p.code,
                  name: p.name,
                  category: categoryLabel(p.category),
                  currentStock: p.currentStock,
                  minimumStock: p.minimumStock,
                  unit: unitLabel(p.unit),
                  unitPrice: p.unitPrice != null ? p.unitPrice : "",
                  status: stockStatusLabel(p.currentStock, p.minimumStock),
                })),
                "yedek-parcalar",
                [
                  { key: "code", header: "Parça Kodu" },
                  { key: "name", header: "Parça Adı" },
                  { key: "category", header: "Kategori" },
                  { key: "currentStock", header: "Mevcut Stok" },
                  { key: "minimumStock", header: "Min. Stok" },
                  { key: "unit", header: "Birim" },
                  { key: "unitPrice", header: "Birim Fiyat (TL)" },
                  { key: "status", header: "Durum" },
                ]
              )
            }
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSV İndir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBulkMessage(null);
              setShowBulkStockDialog(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Toplu Stok Girişi
          </Button>
          <Link href="/parcalar/yeni" className={buttonVariants()}>
            <Plus className="h-4 w-4 mr-2" />
            Parça Ekle
          </Link>
        </div>
      </div>

      {/* Feedback message */}
      {bulkMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-2 ${
            bulkMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{bulkMessage.text}</span>
          <button onClick={() => setBulkMessage(null)} aria-label="Kapat">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <StockAlerts />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Parça kodu veya adı ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Select
                className="w-full sm:w-44"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as SparePartCategory | "")}
              >
                <option value="">Tüm Kategoriler</option>
                {SPARE_PART_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={onlyBelowMin}
                  onChange={(e) => setOnlyBelowMin(e.target.checked)}
                />
                Sadece düşük stok
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Yedek parçalar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {spareParts?.length === 0
                ? "Henüz yedek parça eklenmemiş."
                : "Filtreyle eşleşen parça bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Parça Kodu
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Parça Adı
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Kategori
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Birim
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Stok
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Min. Stok
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Fiyat
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((part) => (
                    <tr key={part.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{part.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{part.name}</div>
                        {part.location && (
                          <div className="text-xs text-muted-foreground">{part.location}</div>
                        )}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {categoryLabel(part.category)}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {unitLabel(part.unit)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{part.currentStock}</span>
                          <Badge variant={stockStatusVariant(part.currentStock, part.minimumStock)}>
                            {stockStatusLabel(part.currentStock, part.minimumStock)}
                          </Badge>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {part.minimumStock}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground">
                        {part.unitPrice != null ? formatCurrency(part.unitPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/parcalar/${part.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk stock entry dialog */}
      {showBulkStockDialog && spareParts && (
        <BulkStockDialog
          spareParts={spareParts}
          onClose={() => setShowBulkStockDialog(false)}
          onSuccess={handleBulkStockSuccess}
        />
      )}
    </div>
  );
}
