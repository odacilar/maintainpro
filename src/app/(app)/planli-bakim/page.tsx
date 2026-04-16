"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { buttonVariants, Button } from "@/components/ui/button";
import { Plus, Zap } from "lucide-react";
import {
  frequencyLabel,
  priorityLabel,
  priorityVariant,
  PM_FREQUENCIES,
  formatDate,
  intervalDaysToFrequency,
  parsePriority,
} from "@/lib/pm-helpers";
import type { PmFrequency } from "@/lib/validations/pm-plan";
import type { Machine } from "@/types/machine";

interface PmPlan {
  id: string;
  name: string;
  machineId: string;
  machine: { id: string; name: string; code: string };
  maintenanceType: string;
  intervalDays: number;
  isActive: boolean;
  nextScheduledAt: string | null;
  lastExecutedAt: string | null;
  estimatedDurationMinutes: number | null;
}

export default function PlanliMonthPage() {
  const [filterMachine, setFilterMachine] = useState("");
  const [filterFrequency, setFilterFrequency] = useState<PmFrequency | "">("");
  const [filterActive, setFilterActive] = useState<"" | "true" | "false">("");
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: plans, isLoading, isError } = useQuery<PmPlan[]>({
    queryKey: ["pm-plans"],
    queryFn: () => fetch("/api/pm-plans").then((r) => r.json()),
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  async function handleGenerateWorkOrders() {
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const res = await fetch("/api/pm-plans/generate-work-orders", { method: "POST" });
      if (!res.ok) {
        setGenerateMessage({ type: "error", text: "İş emirleri oluşturulurken bir hata oluştu." });
        return;
      }
      const data = (await res.json()) as { created: number };
      setGenerateMessage({
        type: "success",
        text: data.created > 0
          ? `${data.created} iş emri oluşturuldu.`
          : "Şu an için oluşturulacak iş emri bulunamadı.",
      });
    } catch {
      setGenerateMessage({ type: "error", text: "Sunucu bağlantı hatası." });
    } finally {
      setGenerating(false);
    }
  }

  const filtered = useMemo(() => {
    if (!plans) return [];
    return plans.filter((p) => {
      const matchMachine = !filterMachine || p.machineId === filterMachine;
      const matchFreq =
        !filterFrequency ||
        intervalDaysToFrequency(p.intervalDays) === filterFrequency;
      const matchActive =
        filterActive === "" ||
        (filterActive === "true" ? p.isActive : !p.isActive);
      return matchMachine && matchFreq && matchActive;
    });
  }, [plans, filterMachine, filterFrequency, filterActive]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Planlı Bakım</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateWorkOrders}
            disabled={generating}
          >
            <Zap className="h-4 w-4 mr-1.5" />
            {generating ? "Oluşturuluyor..." : "Toplu İş Emri Oluştur"}
          </Button>
          <Link href="/planli-bakim/yeni" className={buttonVariants()}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Plan
          </Link>
        </div>
      </div>

      {/* Generate result message */}
      {generateMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            generateMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {generateMessage.text}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium flex-1">Planlar</p>
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
                value={filterFrequency}
                onChange={(e) => setFilterFrequency(e.target.value as PmFrequency | "")}
              >
                <option value="">Tüm Frekanslar</option>
                {PM_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {frequencyLabel(f)}
                  </option>
                ))}
              </Select>
              <Select
                className="w-full sm:w-36"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as "" | "true" | "false")}
              >
                <option value="">Tüm Durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              Yükleniyor...
            </div>
          )}
          {isError && (
            <div className="py-16 text-center text-destructive text-sm">
              Planlar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {plans?.length === 0
                ? "Henüz planlı bakım planı oluşturulmamış."
                : "Filtreyle eşleşen plan bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Plan Adı
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Makine
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Frekans
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Öncelik
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Sonraki Tarih
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((plan) => {
                    const priority = parsePriority(plan.maintenanceType);
                    const frequency = intervalDaysToFrequency(plan.intervalDays);
                    return (
                      <tr
                        key={plan.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium">{plan.name}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{plan.machine.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {plan.machine.code}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                          {frequencyLabel(frequency)}
                        </td>
                        <td className="hidden md:table-cell px-4 py-3">
                          <Badge variant={priorityVariant(priority)}>
                            {priorityLabel(priority)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={plan.isActive ? "success" : "secondary"}>
                            {plan.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground text-xs">
                          {plan.nextScheduledAt ? formatDate(plan.nextScheduledAt) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/planli-bakim/${plan.id}`}
                              className={buttonVariants({ variant: "outline", size: "sm" })}
                            >
                              Detay
                            </Link>
                            <Link
                              href={`/planli-bakim/${plan.id}/duzenle`}
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                            >
                              Düzenle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
