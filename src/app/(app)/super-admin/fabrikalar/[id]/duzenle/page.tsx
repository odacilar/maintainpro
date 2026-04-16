"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { FactoryForm } from "../../_components/factory-form";
import type { FactoryFormData, Plan } from "../../_components/factory-form";

interface FactoryDetail {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  plan: Plan;
}

function toFormValues(factory: FactoryDetail): FactoryFormData {
  return {
    name: factory.name,
    slug: factory.slug,
    city: factory.city ?? "",
    address: factory.address ?? "",
    phone: factory.phone ?? "",
    plan: factory.plan,
  };
}

const defaultValues: FactoryFormData = {
  name: "",
  slug: "",
  city: "",
  address: "",
  phone: "",
  plan: "STARTER",
};

export default function FabrikaDuzenlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FactoryFormData>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof FactoryFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: factory, isLoading, isError } = useQuery<FactoryDetail>({
    queryKey: ["admin-factories", id],
    queryFn: () => fetch(`/api/admin/factories/${id}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (factory) {
      setValues(toFormValues(factory));
    }
  }, [factory]);

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

  const mutation = useMutation<FactoryDetail, Error, FactoryFormData>({
    mutationFn: (data) =>
      fetch(`/api/admin/factories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Fabrika güncellenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-factories"] });
      queryClient.invalidateQueries({ queryKey: ["admin-factories", id] });
      router.push(`/super-admin/fabrikalar/${id}`);
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

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !factory) {
    return <div className="py-20 text-center text-destructive text-sm">Fabrika bulunamadı.</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href={`/super-admin/fabrikalar/${id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Detay
        </Link>
        <h1 className="text-2xl font-semibold">Fabrika Düzenle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{factory.name}</CardTitle>
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
            onCancel={() => router.push(`/super-admin/fabrikalar/${id}`)}
            errors={errors}
            isPending={mutation.isPending}
            submitLabel="Kaydet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
