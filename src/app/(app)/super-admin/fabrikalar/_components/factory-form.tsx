"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type Plan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface FactoryFormData {
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  plan: Plan;
}

interface FactoryFormProps {
  values: FactoryFormData;
  onChange: (field: keyof FactoryFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  errors: Partial<Record<keyof FactoryFormData, string>>;
  isPending: boolean;
  submitLabel: string;
}

export function FactoryForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  errors,
  isPending,
  submitLabel,
}: FactoryFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Fabrika Adı <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="Örnek Fabrika A.Ş."
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            required
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">
            Slug <span className="text-destructive">*</span>
          </Label>
          <Input
            id="slug"
            placeholder="ornek-fabrika"
            value={values.slug}
            onChange={(e) => onChange("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            required
          />
          {errors.slug ? (
            <p className="text-xs text-destructive">{errors.slug}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Küçük harf, rakam ve tire kullanın.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Şehir</Label>
          <Input
            id="city"
            placeholder="İstanbul"
            value={values.city}
            onChange={(e) => onChange("city", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+90 212 000 00 00"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="plan">
            Plan <span className="text-destructive">*</span>
          </Label>
          <Select
            id="plan"
            value={values.plan}
            onChange={(e) => onChange("plan", e.target.value)}
            required
          >
            <option value="STARTER">Starter — $99/ay (5 kullanıcı / 20 makine / 5 GB)</option>
            <option value="PROFESSIONAL">Professional — $199/ay (15 kullanıcı / 50 makine / 20 GB)</option>
            <option value="ENTERPRISE">Enterprise — $399/ay (Sınırsız kullanıcı / 100 makine / 100 GB)</option>
          </Select>
          {errors.plan && <p className="text-xs text-destructive">{errors.plan}</p>}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Adres</Label>
          <Textarea
            id="address"
            placeholder="Fabrika adresi..."
            rows={3}
            value={values.address}
            onChange={(e) => onChange("address", e.target.value)}
          />
        </div>
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
