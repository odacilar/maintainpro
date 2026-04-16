"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import { Plus, ClipboardList } from "lucide-react";
import { periodLabel, CHECKLIST_PERIODS } from "@/lib/checklist-helpers";
import type { ChecklistTemplate, ChecklistPeriod } from "@/types/checklist";
import type { Machine } from "@/types/machine";

export default function OtonomBakimPage() {
  const queryClient = useQueryClient();
  const [filterMachine, setFilterMachine] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<ChecklistPeriod | "">("");

  const { data: templates, isLoading, isError } = useQuery<ChecklistTemplate[]>({
    queryKey: ["checklist-templates"],
    queryFn: () => fetch("/api/checklists/templates").then((r) => r.json()),
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  const toggleActiveMutation = useMutation<
    ChecklistTemplate,
    Error,
    { id: string; isActive: boolean }
  >({
    mutationFn: ({ id, isActive }) =>
      fetch(`/api/checklists/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "İşlem gerçekleştirilemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    },
  });

  const filtered = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      const matchMachine = !filterMachine || t.machineId === filterMachine;
      const matchPeriod = !filterPeriod || t.period === filterPeriod;
      return matchMachine && matchPeriod;
    });
  }, [templates, filterMachine, filterPeriod]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Otonom Bakım</h1>
        <div className="flex gap-2">
          <Link
            href="/otonom-bakim/gunluk"
            className={buttonVariants({ variant: "outline" })}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Bugünkü Kontroller
          </Link>
          <Link
            href="/otonom-bakim/sablonlar/yeni"
            className={buttonVariants()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Şablon Oluştur
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium flex-1">Şablonlar</p>
            <div className="flex gap-2 flex-wrap">
              <Select
                className="w-full sm:w-52"
                value={filterMachine}
                onChange={(e) => setFilterMachine(e.target.value)}
              >
                <option value="">Tüm Makineler</option>
                {machines?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.code}
                  </option>
                ))}
              </Select>
              <Select
                className="w-full sm:w-44"
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value as ChecklistPeriod | "")}
              >
                <option value="">Tüm Periyotlar</option>
                {CHECKLIST_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Şablonlar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {templates?.length === 0
                ? "Henüz kontrol listesi şablonu oluşturulmamış."
                : "Filtreyle eşleşen şablon bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Şablon Adı
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Makine
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Periyot
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Madde Sayısı
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((template) => (
                    <tr
                      key={template.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {template.name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{template.machine?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {template.machine?.code}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {periodLabel(template.period)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {template._count?.items ?? template.items.length} madde
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: template.id,
                              isActive: !template.isActive,
                            })
                          }
                          disabled={toggleActiveMutation.isPending}
                          className="cursor-pointer"
                          title={template.isActive ? "Pasifleştir" : "Aktifleştir"}
                        >
                          <Badge variant={template.isActive ? "success" : "secondary"}>
                            {template.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/otonom-bakim/sablonlar/${template.id}`}
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
    </div>
  );
}
