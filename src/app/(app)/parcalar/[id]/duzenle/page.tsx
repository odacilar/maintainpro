"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { SparePartForm } from "../../_components/spare-part-form";
import type { SparePartFormData, SparePart } from "@/types/spare-part";

const emptyValues: SparePartFormData = {
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

export default function ParcaDuzenlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<SparePartFormData>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<keyof SparePartFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: part, isLoading, isError } = useQuery<SparePart>({
    queryKey: ["spare-parts", id],
    queryFn: () => fetch(`/api/spare-parts/${id}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (part) {
      setValues({
        code: part.code,
        name: part.name,
        category: part.category,
        unit: part.unit,
        minimumStock: String(part.minimumStock),
        unitPrice: part.unitPrice != null ? String(part.unitPrice) : "",
        description: part.description ?? "",
        supplier: part.supplier ?? "",
        leadTimeDays: part.leadTimeDays != null ? String(part.leadTimeDays) : "",
        location: part.location ?? "",
        barcode: part.barcode ?? "",
      });
    }
  }, [part]);

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
      fetch(`/api/spare-parts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Parça güncellenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spare-parts"] });
      queryClient.invalidateQueries({ queryKey: ["spare-parts", id] });
      router.push(`/parcalar/${id}`);
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

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !part) {
    return (
      <div className="py-20 text-center text-destructive text-sm">Parça bulunamadı.</div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href={`/parcalar/${id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Parça Detayı
        </Link>
        <h1 className="text-2xl font-semibold">Parça Düzenle</h1>
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
            onCancel={() => router.push(`/parcalar/${id}`)}
            errors={errors}
            isPending={mutation.isPending}
            submitLabel="Kaydet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
