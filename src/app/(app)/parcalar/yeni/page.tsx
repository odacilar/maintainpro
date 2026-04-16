"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SparePartForm } from "../_components/spare-part-form";
import type { SparePartFormData, SparePart } from "@/types/spare-part";

const defaultValues: SparePartFormData = {
  code: "",
  name: "",
  category: "",
  unit: "",
  minimumStock: "0",
  unitPrice: "",
  description: "",
  supplier: "",
  leadTimeDays: "",
  location: "",
  barcode: "",
};

export default function YeniParcaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SparePartFormData>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof SparePartFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(field: keyof SparePartFormData, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof SparePartFormData, string>> = {};
    if (!values.code.trim()) newErrors.code = "Parça kodu zorunludur.";
    if (!values.name.trim()) newErrors.name = "Parça adı zorunludur.";
    if (!values.category) newErrors.category = "Kategori zorunludur.";
    if (!values.unit) newErrors.unit = "Birim zorunludur.";
    if (!values.minimumStock || isNaN(Number(values.minimumStock)) || Number(values.minimumStock) < 0) {
      newErrors.minimumStock = "Geçerli bir minimum stok giriniz.";
    }
    if (values.unitPrice && (isNaN(Number(values.unitPrice)) || Number(values.unitPrice) < 0)) {
      newErrors.unitPrice = "Geçerli bir fiyat giriniz.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const mutation = useMutation<SparePart, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetch("/api/spare-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Parça kaydedilemedi.");
        }
        return r.json();
      }),
    onSuccess: (part) => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      router.push(`/parcalar/${part.id}`);
    },
    onError: (err) => {
      setServerError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    mutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      category: values.category,
      unit: values.unit,
      minimumStock: Number(values.minimumStock),
      unitPrice: values.unitPrice ? Number(values.unitPrice) : null,
      description: values.description.trim() || null,
      supplier: values.supplier.trim() || null,
      leadTimeDays: values.leadTimeDays ? Number(values.leadTimeDays) : null,
      location: values.location.trim() || null,
      barcode: values.barcode.trim() || null,
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/parcalar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Yedek Parçalar
        </Link>
        <h1 className="text-2xl font-semibold">Yeni Parça Ekle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parça Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <SparePartForm
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/parcalar")}
            errors={errors}
            isPending={mutation.isPending}
            submitLabel="Parça Ekle"
          />
        </CardContent>
      </Card>
    </div>
  );
}
