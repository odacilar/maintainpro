"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FactoryForm } from "../_components/factory-form";
import type { FactoryFormData } from "../_components/factory-form";

const defaultValues: FactoryFormData = {
  name: "",
  slug: "",
  city: "",
  address: "",
  phone: "",
  plan: "STARTER",
};

export default function YeniFabrikaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FactoryFormData>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FactoryFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(field: keyof FactoryFormData, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FactoryFormData, string>> = {};
    if (!values.name.trim()) newErrors.name = "Fabrika adı zorunludur.";
    if (!values.slug.trim()) newErrors.slug = "Slug zorunludur.";
    else if (!/^[a-z0-9-]+$/.test(values.slug)) newErrors.slug = "Slug yalnızca küçük harf, rakam ve tire içerebilir.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const mutation = useMutation<{ id: string }, Error, FactoryFormData>({
    mutationFn: (data) =>
      fetch("/api/admin/factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Fabrika kaydedilemedi.");
        }
        return r.json();
      }),
    onSuccess: (factory) => {
      queryClient.invalidateQueries({ queryKey: ["admin-factories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      router.push(`/super-admin/fabrikalar/${factory.id}`);
    },
    onError: (err) => {
      setServerError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    mutation.mutate(values);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/super-admin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Yönetim Paneli
        </Link>
        <h1 className="text-2xl font-semibold">Yeni Fabrika Ekle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fabrika Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <FactoryForm
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/super-admin")}
            errors={errors}
            isPending={mutation.isPending}
            submitLabel="Fabrikayı Oluştur"
          />
        </CardContent>
      </Card>
    </div>
  );
}
