"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import {
  stockStatusLabel,
  stockStatusVariant,
  movementTypeLabel,
  movementTypeVariant,
  categoryLabel,
  unitLabel,
  formatCurrency,
} from "@/lib/spare-part-helpers";
import { formatDateTime } from "@/lib/breakdown-helpers";
import type { SparePart, StockMovement, StockMovementType } from "@/types/spare-part";
import type { Machine } from "@/types/machine";
import type { BreakdownListItem } from "@/types/breakdown";

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

type ActivePanel = StockMovementType | null;

interface MovementFormState {
  quantity: string;
  machineId: string;
  breakdownId: string;
  unitPrice: string;
  note: string;
  newStock: string;
}

const emptyForm: MovementFormState = {
  quantity: "",
  machineId: "",
  breakdownId: "",
  unitPrice: "",
  note: "",
  newStock: "",
};

const PANEL_LABELS: Record<StockMovementType, string> = {
  IN: "Stok Giriş",
  OUT: "Stok Çıkış",
  RETURN: "İade",
  ADJUSTMENT: "Sayım Düzeltme",
  SCRAP: "Hurda",
};

export default function ParcaDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [form, setForm] = useState<MovementFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: part, isLoading, isError } = useQuery<SparePart>({
    queryKey: ["spare-parts", id],
    queryFn: () => fetch(`/api/spare-parts/${id}`).then((r) => r.json()),
  });

  const { data: movements, isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["spare-parts", id, "movements"],
    queryFn: () => fetch(`/api/spare-parts/${id}/movements`).then((r) => r.json()),
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
    enabled: activePanel === "OUT" || activePanel === "RETURN",
  });

  const { data: activeBreakdowns } = useQuery<BreakdownListItem[]>({
    queryKey: ["breakdowns", "active"],
    queryFn: () =>
      fetch("/api/breakdowns?status=IN_PROGRESS&status=WAITING_PARTS").then((r) => r.json()),
    enabled: activePanel === "OUT",
  });

  const movementMutation = useMutation<StockMovement, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetch(`/api/spare-parts/${id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "İşlem gerçekleştirilemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts", id] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts", id, "movements"] });
      setActivePanel(null);
      setForm(emptyForm);
      setFormError(null);
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation<void, Error>({
    mutationFn: () =>
      fetch(`/api/spare-parts/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Parça silinemedi.");
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      router.push("/parcalar");
    },
  });

  function openPanel(type: StockMovementType) {
    setActivePanel(type);
    setForm(emptyForm);
    setFormError(null);
  }

  function closePanel() {
    setActivePanel(null);
    setForm(emptyForm);
    setFormError(null);
  }

  function handleFormChange(field: keyof MovementFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!activePanel) return;

    if (activePanel === "ADJUSTMENT") {
      if (!form.newStock || isNaN(Number(form.newStock)) || Number(form.newStock) < 0) {
        setFormError("Geçerli bir miktar giriniz.");
        return;
      }
      movementMutation.mutate({
        type: activePanel,
        quantity: Number(form.newStock),
        note: form.note.trim() || null,
      });
      return;
    }

    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      setFormError("Geçerli bir miktar giriniz.");
      return;
    }

    movementMutation.mutate({
      type: activePanel,
      quantity: Number(form.quantity),
      machineId: form.machineId || null,
      breakdownId: form.breakdownId || null,
      unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
      note: form.note.trim() || null,
    });
  }

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !part) {
    return (
      <div className="py-20 text-center text-destructive text-sm">Parça bulunamadı.</div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/parcalar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Yedek Parçalar
        </Link>
        <h1 className="text-2xl font-semibold flex-1 font-mono">{part.code}</h1>
        <Badge variant={stockStatusVariant(part.currentStock, part.minimumStock)}>
          {stockStatusLabel(part.currentStock, part.minimumStock)}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">{part.name}</CardTitle>
            <div className="flex gap-2">
              <Link
                href={`/parcalar/${id}/duzenle`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Düzenle
              </Link>
              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Sil
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">Emin misiniz?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Siliniyor..." : "Evet, Sil"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteMutation.isPending}
                  >
                    İptal
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
            <FieldRow label="Parça Kodu" value={<span className="font-mono">{part.code}</span>} />
            <FieldRow label="Kategori" value={categoryLabel(part.category)} />
            <FieldRow label="Birim" value={unitLabel(part.unit)} />
            <FieldRow
              label="Mevcut Stok"
              value={
                <span className={
                  part.currentStock === 0
                    ? "text-red-600"
                    : part.currentStock <= part.minimumStock
                    ? "text-amber-600"
                    : "text-green-600"
                }>
                  {part.currentStock} {unitLabel(part.unit)}
                </span>
              }
            />
            <FieldRow label="Minimum Stok" value={`${part.minimumStock} ${unitLabel(part.unit)}`} />
            <FieldRow
              label="Birim Fiyat"
              value={part.unitPrice != null ? formatCurrency(part.unitPrice) : null}
            />
            <FieldRow label="Tedarikçi" value={part.supplier} />
            <FieldRow
              label="Tedarik Süresi"
              value={part.leadTimeDays != null ? `${part.leadTimeDays} gün` : null}
            />
            <FieldRow label="Raf/Konum" value={part.location} />
            <FieldRow label="Barkod" value={part.barcode ? <span className="font-mono text-xs">{part.barcode}</span> : null} />
          </div>
          {part.description && (
            <div className="mt-6 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Açıklama
              </p>
              <p className="text-sm whitespace-pre-wrap">{part.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stok İşlemleri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["IN", "OUT", "RETURN", "ADJUSTMENT", "SCRAP"] as StockMovementType[]).map((type) => (
              <Button
                key={type}
                variant={activePanel === type ? "default" : "outline"}
                size="sm"
                onClick={() => (activePanel === type ? closePanel() : openPanel(type))}
              >
                {PANEL_LABELS[type]}
              </Button>
            ))}
          </div>

          {activePanel && (
            <div className="rounded-md border p-4 space-y-4 bg-muted/20">
              <h3 className="text-sm font-semibold">{PANEL_LABELS[activePanel]}</h3>
              {formError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                  {formError}
                </div>
              )}
              <form onSubmit={handleMovementSubmit} className="space-y-4">
                {activePanel === "ADJUSTMENT" ? (
                  <div className="space-y-2">
                    <Label htmlFor="newStock">
                      Yeni Stok Miktarı <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="newStock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.newStock}
                      onChange={(e) => handleFormChange("newStock", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Mevcut stok: {part.currentStock} {unitLabel(part.unit)}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">
                        Miktar <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        placeholder="1"
                        value={form.quantity}
                        onChange={(e) => handleFormChange("quantity", e.target.value)}
                      />
                    </div>

                    {activePanel === "IN" && (
                      <div className="space-y-2">
                        <Label htmlFor="unitPriceIn">Birim Fiyat (₺)</Label>
                        <Input
                          id="unitPriceIn"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0,00"
                          value={form.unitPrice}
                          onChange={(e) => handleFormChange("unitPrice", e.target.value)}
                        />
                      </div>
                    )}

                    {(activePanel === "OUT" || activePanel === "RETURN") && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="machineSelect">Makine</Label>
                          <Select
                            id="machineSelect"
                            value={form.machineId}
                            onChange={(e) => handleFormChange("machineId", e.target.value)}
                          >
                            <option value="">Seçiniz</option>
                            {machines?.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {m.code}
                              </option>
                            ))}
                          </Select>
                        </div>

                        {activePanel === "OUT" && (
                          <div className="space-y-2">
                            <Label htmlFor="breakdownSelect">Arıza No (opsiyonel)</Label>
                            <Select
                              id="breakdownSelect"
                              value={form.breakdownId}
                              onChange={(e) => handleFormChange("breakdownId", e.target.value)}
                            >
                              <option value="">Seçiniz</option>
                              {activeBreakdowns?.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.code} — {b.machine.name}
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="movementNote">Açıklama</Label>
                  <Textarea
                    id="movementNote"
                    rows={2}
                    placeholder="Ek bilgi..."
                    value={form.note}
                    onChange={(e) => handleFormChange("note", e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={movementMutation.isPending}>
                    {movementMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={closePanel}
                    disabled={movementMutation.isPending}
                  >
                    İptal
                  </Button>
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hareket Geçmişi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movementsLoading && (
            <div className="py-10 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {!movementsLoading && (!movements || movements.length === 0) && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Henüz stok hareketi yok.
            </div>
          )}
          {!movementsLoading && movements && movements.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tarih</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tip</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Miktar
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Kullanıcı
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Makine
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Arıza No
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Açıklama
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...movements]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    )
                    .map((mv) => (
                      <tr key={mv.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(mv.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={movementTypeVariant(mv.type)}>
                            {movementTypeLabel(mv.type)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <span
                            className={
                              mv.type === "IN" || mv.type === "RETURN"
                                ? "text-green-600"
                                : mv.type === "OUT" || mv.type === "SCRAP"
                                ? "text-red-600"
                                : "text-amber-600"
                            }
                          >
                            {mv.type === "IN" || mv.type === "RETURN"
                              ? "+"
                              : mv.type === "OUT" || mv.type === "SCRAP"
                              ? "-"
                              : ""}
                            {mv.quantity}
                          </span>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                          {mv.user.name ?? mv.user.email}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                          {mv.machine ? (
                            <Link
                              href={`/makineler/${mv.machine.id}`}
                              className="hover:text-primary hover:underline"
                            >
                              {mv.machine.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3">
                          {mv.breakdown ? (
                            <Link
                              href={`/arizalar/${mv.breakdown.id}`}
                              className="font-mono text-xs text-primary hover:underline"
                            >
                              {mv.breakdown.code}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground max-w-xs truncate">
                          {mv.note ?? "—"}
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
