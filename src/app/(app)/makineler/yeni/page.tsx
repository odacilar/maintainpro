"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MachineForm } from "../_components/machine-form";
import type { MachineFormData, Machine } from "@/types/machine";

const defaultValues: MachineFormData = {
  code: "",
  name: "",
  departmentId: "",
  criticality: "B",
  status: "RUNNING",
  line: "",
  brand: "",
  model: "",
  serialNumber: "",
  installedAt: "",
  warrantyEndsAt: "",
  notes: "",
};

export default function YeniMakinePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<MachineFormData>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof MachineFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function handleChange(field: keyof MachineFormData, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof MachineFormData, string>> = {};
    if (!values.code.trim()) newErrors.code = "Makine kodu zorunludur.";
    if (!values.name.trim()) newErrors.name = "Makine adı zorunludur.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const mutation = useMutation<Machine, Error, MachineFormData>({
    mutationFn: (data) =>
      fetch("/api/machines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? body.error ?? "Makine kaydedilemedi.");
        }
        return r.json();
      }),
    onSuccess: (machine) => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      router.push(`/makineler/${machine.id}`);
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
        <Link href="/makineler" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Makineler
        </Link>
        <h1 className="text-2xl font-semibold">Yeni Makine Ekle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Makine Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <MachineForm
            values={values}
            onChange={handleChange}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/makineler")}
            errors={errors}
            isPending={mutation.isPending}
            submitLabel="Kaydet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
