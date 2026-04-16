"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Plus, Search, Download } from "lucide-react";
import { buttonVariants, Button } from "@/components/ui/button";
import { exportToCSV } from "@/lib/utils/export";
import type { Machine, Department, MachineStatus, MachineCriticality } from "@/types/machine";

function statusBadge(status: MachineStatus) {
  switch (status) {
    case "RUNNING":
      return <Badge variant="success">Çalışıyor</Badge>;
    case "BROKEN":
      return <Badge variant="danger">Arızalı</Badge>;
    case "IN_MAINTENANCE":
      return <Badge variant="warning">Bakımda</Badge>;
    case "DECOMMISSIONED":
      return <Badge variant="secondary">Devre Dışı</Badge>;
  }
}

function criticalityBadge(criticality: MachineCriticality) {
  switch (criticality) {
    case "A":
      return <Badge variant="danger">Kritik (A)</Badge>;
    case "B":
      return <Badge variant="warning">Önemli (B)</Badge>;
    case "C":
      return <Badge className="border-transparent bg-blue-100 text-blue-800">Destek (C)</Badge>;
  }
}

export default function MakinelerPage() {
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState<MachineStatus | "">("");
  const [filterCriticality, setFilterCriticality] = useState<MachineCriticality | "">("");

  const { data: machines, isLoading, isError } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => fetch("/api/departments").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    if (!machines) return [];
    return machines.filter((m) => {
      const matchSearch =
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.code.toLowerCase().includes(search.toLowerCase());
      const matchDept = !filterDept || m.departmentId === filterDept;
      const matchStatus = !filterStatus || m.status === filterStatus;
      const matchCrit = !filterCriticality || m.criticality === filterCriticality;
      return matchSearch && matchDept && matchStatus && matchCrit;
    });
  }, [machines, search, filterDept, filterStatus, filterCriticality]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold">Makineler</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportToCSV(
                filtered.map((m) => ({
                  code: m.code,
                  name: m.name,
                  department: m.department?.name ?? "—",
                  status:
                    m.status === "RUNNING"
                      ? "Çalışıyor"
                      : m.status === "BROKEN"
                      ? "Arızalı"
                      : m.status === "IN_MAINTENANCE"
                      ? "Bakımda"
                      : "Devre Dışı",
                  criticality:
                    m.criticality === "A"
                      ? "Kritik (A)"
                      : m.criticality === "B"
                      ? "Önemli (B)"
                      : "Destek (C)",
                })),
                "makineler",
                [
                  { key: "code", header: "Makine Kodu" },
                  { key: "name", header: "Makine Adı" },
                  { key: "department", header: "Departman" },
                  { key: "status", header: "Durum" },
                  { key: "criticality", header: "Kritiklik" },
                ]
              )
            }
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            CSV İndir
          </Button>
          <Link href="/makineler/yeni" className={buttonVariants()}>
            <Plus className="h-4 w-4 mr-2" />
            Makine Ekle
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select
                className="w-full sm:w-44"
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
              >
                <option value="">Tüm Departmanlar</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              <Select
                className="w-full sm:w-40"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MachineStatus | "")}
              >
                <option value="">Tüm Durumlar</option>
                <option value="RUNNING">Çalışıyor</option>
                <option value="BROKEN">Arızalı</option>
                <option value="IN_MAINTENANCE">Bakımda</option>
                <option value="DECOMMISSIONED">Devre Dışı</option>
              </Select>
              <Select
                className="w-full sm:w-40"
                value={filterCriticality}
                onChange={(e) => setFilterCriticality(e.target.value as MachineCriticality | "")}
              >
                <option value="">Tüm Kritiklik</option>
                <option value="A">Kritik (A)</option>
                <option value="B">Önemli (B)</option>
                <option value="C">Destek (C)</option>
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
              Makineler yüklenemedi.
            </div>
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground text-sm">
              {machines?.length === 0
                ? "Henüz makine eklenmemiş."
                : "Filtreyle eşleşen makine bulunamadı."}
            </div>
          )}
          {!isLoading && !isError && filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Kod</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ad</th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Departman
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Kritiklik
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((machine) => (
                    <tr key={machine.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{machine.code}</td>
                      <td className="px-4 py-3 font-medium">{machine.name}</td>
                      <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                        {machine.department?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">{statusBadge(machine.status)}</td>
                      <td className="hidden sm:table-cell px-4 py-3">
                        {criticalityBadge(machine.criticality)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/makineler/${machine.id}`}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Detay
                          </Link>
                          <Link
                            href={`/makineler/${machine.id}/duzenle`}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            Düzenle
                          </Link>
                        </div>
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
