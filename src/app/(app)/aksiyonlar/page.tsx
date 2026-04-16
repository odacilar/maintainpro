"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { buttonVariants } from "@/components/ui/button";
import {
  actionStatusLabel,
  actionStatusVariant,
  actionPriorityLabel,
  actionPriorityVariant,
  ACTION_STATUSES,
  ACTION_PRIORITIES,
} from "@/lib/checklist-helpers";
import { formatDateTime } from "@/lib/breakdown-helpers";
import type { Action, ActionStatus, ActionPriority } from "@/types/checklist";

export default function AksiyonlarPage() {
  const [filterStatus, setFilterStatus] = useState<ActionStatus | "">("");
  const [filterPriority, setFilterPriority] = useState<ActionPriority | "">("");

  const { data: actions, isLoading, isError } = useQuery<Action[]>({
    queryKey: ["actions"],
    queryFn: () => fetch("/api/actions").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    if (!actions) return [];
    return [...actions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((a) => {
        const matchStatus = !filterStatus || a.status === filterStatus;
        const matchPriority = !filterPriority || a.priority === filterPriority;
        return matchStatus && matchPriority;
      });
  }, [actions, filterStatus, filterPriority]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Aksiyonlar</h1>
        {actions && actions.length > 0 && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {actions.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length} açık
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <p className="text-sm font-medium flex-1">Aksiyon Listesi</p>
            <div className="flex gap-2 flex-wrap">
              <Select
                className="w-full sm:w-44"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as ActionStatus | "")}
              >
                <option value="">Tüm Durumlar</option>
                {ACTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {actionStatusLabel(s)}
                  </option>
                ))}
              </Select>
              <Select
                className="w-full sm:w-40"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value as ActionPriority | "")}
              >
                <option value="">Tüm Öncelikler</option>
                {ACTION_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {actionPriorityLabel(p)}
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
              Aksiyonlar yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {actions?.length === 0
                ? "Henüz aksiyon kaydı bulunmuyor."
                : "Filtreyle eşleşen aksiyon bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kod</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Kontrol Listesi
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Anormallik
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Öncelik
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Atanan
                    </th>
                    <th className="hidden lg:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Hedef Tarih
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((action) => (
                    <tr
                      key={action.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs font-semibold whitespace-nowrap">
                        {action.code}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground text-xs">
                        {action.record?.template?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-sm">{action.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionPriorityVariant(action.priority)}>
                          {actionPriorityLabel(action.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={actionStatusVariant(action.status)}>
                          {actionStatusLabel(action.status)}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground text-xs">
                        {action.assignee?.name ?? "—"}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-muted-foreground text-xs">
                        {action.targetDate ? formatDateTime(action.targetDate) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/aksiyonlar/${action.id}`}
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
