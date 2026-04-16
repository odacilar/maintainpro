"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { periodLabel, CHECKLIST_PERIODS, itemTypeLabel, CHECKLIST_ITEM_TYPES } from "@/lib/checklist-helpers";
import type { ChecklistPeriod, ChecklistItemType } from "@/types/checklist";
import type { Machine } from "@/types/machine";

interface ItemDraft {
  _key: string;
  title: string;
  type: ChecklistItemType;
  referenceValue: string;
  photoRequired: boolean;
  choicesRaw: string;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function emptyItem(): ItemDraft {
  return {
    _key: makeKey(),
    title: "",
    type: "YES_NO",
    referenceValue: "",
    photoRequired: false,
    choicesRaw: "",
  };
}

const ROLES = [
  { value: "TECHNICIAN", label: "Teknisyen" },
  { value: "ENGINEER", label: "Mühendis" },
  { value: "FACTORY_ADMIN", label: "Fabrika Yöneticisi" },
];

export default function YeniSablonPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [machineId, setMachineId] = useState("");
  const [period, setPeriod] = useState<ChecklistPeriod>("DAILY");
  const [isActive, setIsActive] = useState(true);
  const [assignedRoles, setAssignedRoles] = useState<string[]>(["TECHNICIAN"]);
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  const createMutation = useMutation<{ id: string }, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetch("/api/checklists/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Şablon oluşturulamadı.");
        }
        return r.json();
      }),
    onSuccess: (data) => {
      router.push(`/otonom-bakim/sablonlar/${data.id}`);
    },
    onError: (err) => {
      setFormError(err.message);
    },
  });

  function toggleRole(role: string) {
    setAssignedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i._key !== key));
  }

  function updateItem(key: string, field: keyof ItemDraft, value: string | boolean) {
    setItems((prev) =>
      prev.map((i) => (i._key === key ? { ...i, [field]: value } : i))
    );
  }

  function moveItem(index: number, direction: "up" | "down") {
    setItems((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) { setFormError("Şablon adı zorunludur."); return; }
    if (!machineId) { setFormError("Makine seçiniz."); return; }
    if (assignedRoles.length === 0) { setFormError("En az bir rol seçiniz."); return; }
    if (items.length === 0) { setFormError("En az bir kontrol maddesi ekleyiniz."); return; }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].title.trim()) {
        setFormError(`${i + 1}. maddenin başlığı boş olamaz.`);
        return;
      }
    }

    const payload = {
      name: name.trim(),
      machineId,
      period,
      isActive,
      assignedRoles,
      items: items.map((item, idx) => ({
        orderIndex: idx,
        title: item.title.trim(),
        type: item.type,
        referenceValue: item.referenceValue.trim() || null,
        photoRequired: item.photoRequired,
        meta:
          item.type === "MULTIPLE_CHOICE" && item.choicesRaw.trim()
            ? { choices: item.choicesRaw.split("\n").map((c) => c.trim()).filter(Boolean) }
            : null,
      })),
    };

    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/otonom-bakim"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Otonom Bakım
        </Link>
        <h1 className="text-2xl font-semibold flex-1">Şablon Oluştur</h1>
      </div>

      {formError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Şablon Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">
                  Şablon Adı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Örn: Günlük Hidrolik Kontrol"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="machine">
                  Makine <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="machine"
                  value={machineId}
                  onChange={(e) => setMachineId(e.target.value)}
                >
                  <option value="">Seçiniz</option>
                  {machines?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.code}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="period">Periyot</Label>
                <Select
                  id="period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as ChecklistPeriod)}
                >
                  {CHECKLIST_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {periodLabel(p)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Atanan Roller <span className="text-destructive">*</span></Label>
              <div className="flex flex-wrap gap-3">
                {ROLES.map((r) => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={assignedRoles.includes(r.value)}
                      onChange={() => toggleRole(r.value)}
                      className="rounded"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Aktif (zamanlayıcı kayıt oluştursun)
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Kontrol Maddeleri</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Madde Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Henüz madde eklenmedi. Madde Ekle butonuna tıklayın.
              </p>
            )}
            {items.map((item, index) => (
              <div
                key={item._key}
                className="rounded-md border p-4 space-y-3 bg-muted/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {index + 1}. Madde
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      title="Yukarı taşı"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, "down")}
                      disabled={index === items.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      title="Aşağı taşı"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item._key)}
                      className="p-1 rounded hover:bg-destructive/10 text-destructive"
                      title="Kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">
                      Başlık <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="Kontrol maddesini açıklayın..."
                      value={item.title}
                      onChange={(e) => updateItem(item._key, "title", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tip</Label>
                    <Select
                      value={item.type}
                      onChange={(e) =>
                        updateItem(item._key, "type", e.target.value as ChecklistItemType)
                      }
                    >
                      {CHECKLIST_ITEM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {itemTypeLabel(t)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {(item.type === "MEASUREMENT" || item.type === "YES_NO") && (
                    <div className="space-y-1">
                      <Label className="text-xs">Referans Değer</Label>
                      <Input
                        placeholder={
                          item.type === "MEASUREMENT" ? "Örn: 2.5–3.0 bar" : "Opsiyonel"
                        }
                        value={item.referenceValue}
                        onChange={(e) => updateItem(item._key, "referenceValue", e.target.value)}
                      />
                    </div>
                  )}
                  {item.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Seçenekler (her satıra bir tane)</Label>
                      <textarea
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder={"Seçenek A\nSeçenek B\nSeçenek C"}
                        value={item.choicesRaw}
                        onChange={(e) => updateItem(item._key, "choicesRaw", e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={item.photoRequired}
                    onChange={(e) => updateItem(item._key, "photoRequired", e.target.checked)}
                    className="rounded"
                  />
                  Fotoğraf Zorunlu
                </label>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Kaydediliyor..." : "Şablon Oluştur"}
          </Button>
          <Link href="/otonom-bakim" className={buttonVariants({ variant: "outline" })}>
            İptal
          </Link>
        </div>
      </form>
    </div>
  );
}
