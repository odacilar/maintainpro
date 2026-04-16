"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Department, MachineFormData } from "@/types/machine";

interface MachineFormProps {
  values: MachineFormData;
  onChange: (field: keyof MachineFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  errors: Partial<Record<keyof MachineFormData, string>>;
  isPending: boolean;
  submitLabel: string;
}

export function MachineForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  errors,
  isPending,
  submitLabel,
}: MachineFormProps) {
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: () => fetch("/api/departments").then((r) => r.json()),
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">
            Makine Kodu <span className="text-destructive">*</span>
          </Label>
          <Input
            id="code"
            placeholder="MAK-001"
            value={values.code}
            onChange={(e) => onChange("code", e.target.value)}
            required
          />
          {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Makine Adı <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="CNC Torna"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            required
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="departmentId">Departman</Label>
          <Select
            id="departmentId"
            value={values.departmentId}
            onChange={(e) => onChange("departmentId", e.target.value)}
          >
            <option value="">Seçiniz</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="line">Hat/Bölge</Label>
          <Input
            id="line"
            placeholder="A Hattı"
            value={values.line}
            onChange={(e) => onChange("line", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="criticality">
            Kritiklik <span className="text-destructive">*</span>
          </Label>
          <Select
            id="criticality"
            value={values.criticality}
            onChange={(e) => onChange("criticality", e.target.value)}
            required
          >
            <option value="A">Kritik (A)</option>
            <option value="B">Önemli (B)</option>
            <option value="C">Destek (C)</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">
            Durum <span className="text-destructive">*</span>
          </Label>
          <Select
            id="status"
            value={values.status}
            onChange={(e) => onChange("status", e.target.value)}
            required
          >
            <option value="RUNNING">Çalışıyor</option>
            <option value="BROKEN">Arızalı</option>
            <option value="IN_MAINTENANCE">Bakımda</option>
            <option value="DECOMMISSIONED">Devre Dışı</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="brand">Marka</Label>
          <Input
            id="brand"
            placeholder="Fanuc"
            value={values.brand}
            onChange={(e) => onChange("brand", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            placeholder="0i-TF"
            value={values.model}
            onChange={(e) => onChange("model", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serialNumber">Seri No</Label>
          <Input
            id="serialNumber"
            placeholder="SN-12345"
            value={values.serialNumber}
            onChange={(e) => onChange("serialNumber", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="installedAt">Kurulum Tarihi</Label>
          <Input
            id="installedAt"
            type="date"
            value={values.installedAt}
            onChange={(e) => onChange("installedAt", e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2 md:col-span-1">
          <Label htmlFor="warrantyEndsAt">Garanti Bitiş</Label>
          <Input
            id="warrantyEndsAt"
            type="date"
            value={values.warrantyEndsAt}
            onChange={(e) => onChange("warrantyEndsAt", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notlar</Label>
        <Textarea
          id="notes"
          placeholder="Ek bilgiler..."
          rows={3}
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Kaydediliyor..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          İptal
        </Button>
      </div>
    </form>
  );
}
