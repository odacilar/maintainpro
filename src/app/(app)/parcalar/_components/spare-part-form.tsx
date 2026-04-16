"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  categoryLabel,
  unitLabel,
  SPARE_PART_CATEGORIES,
  SPARE_PART_UNITS,
} from "@/lib/spare-part-helpers";
import type { SparePartFormData } from "@/types/spare-part";

interface SparePartFormProps {
  values: SparePartFormData;
  onChange: (field: keyof SparePartFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  errors: Partial<Record<keyof SparePartFormData, string>>;
  isPending: boolean;
  submitLabel: string;
}

export function SparePartForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  errors,
  isPending,
  submitLabel,
}: SparePartFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="code">
            Parça Kodu <span className="text-destructive">*</span>
          </Label>
          <Input
            id="code"
            placeholder="PRK-001"
            value={values.code}
            onChange={(e) => onChange("code", e.target.value)}
          />
          {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">
            Parça Adı <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Rulman 6205"
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">
            Kategori <span className="text-destructive">*</span>
          </Label>
          <Select
            id="category"
            value={values.category}
            onChange={(e) => onChange("category", e.target.value)}
          >
            <option value="">Seçiniz</option>
            {SPARE_PART_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </Select>
          {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">
            Birim <span className="text-destructive">*</span>
          </Label>
          <Select
            id="unit"
            value={values.unit}
            onChange={(e) => onChange("unit", e.target.value)}
          >
            <option value="">Seçiniz</option>
            {SPARE_PART_UNITS.map((u) => (
              <option key={u} value={u}>
                {unitLabel(u)}
              </option>
            ))}
          </Select>
          {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="minimumStock">
            Minimum Stok <span className="text-destructive">*</span>
          </Label>
          <Input
            id="minimumStock"
            type="number"
            min="0"
            placeholder="5"
            value={values.minimumStock}
            onChange={(e) => onChange("minimumStock", e.target.value)}
          />
          {errors.minimumStock && (
            <p className="text-xs text-destructive">{errors.minimumStock}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unitPrice">Birim Fiyat (₺)</Label>
          <Input
            id="unitPrice"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={values.unitPrice}
            onChange={(e) => onChange("unitPrice", e.target.value)}
          />
          {errors.unitPrice && <p className="text-xs text-destructive">{errors.unitPrice}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="supplier">Tedarikçi</Label>
          <Input
            id="supplier"
            placeholder="ABC Endüstriyel"
            value={values.supplier}
            onChange={(e) => onChange("supplier", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="leadTimeDays">Tedarik Süresi (gün)</Label>
          <Input
            id="leadTimeDays"
            type="number"
            min="0"
            placeholder="7"
            value={values.leadTimeDays}
            onChange={(e) => onChange("leadTimeDays", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Raf/Konum</Label>
          <Input
            id="location"
            placeholder="A-3-15"
            value={values.location}
            onChange={(e) => onChange("location", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="barcode">Barkod</Label>
          <Input
            id="barcode"
            placeholder="8690000000000"
            value={values.barcode}
            onChange={(e) => onChange("barcode", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Açıklama</Label>
        <Textarea
          id="description"
          placeholder="Parça hakkında ek bilgiler..."
          rows={3}
          value={values.description}
          onChange={(e) => onChange("description", e.target.value)}
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
