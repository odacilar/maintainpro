"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { MachineForm } from "../../_components/machine-form";
import type { Machine, MachineFormData } from "@/types/machine";

function toFormValues(machine: Machine): MachineFormData {
  return {
    code: machine.code,
    name: machine.name,
    departmentId: machine.departmentId ?? "",
    criticality: machine.criticality,
    status: machine.status,
    line: machine.line ?? "",
    brand: machine.brand ?? "",
    model: machine.model ?? "",
    serialNumber: machine.serialNumber ?? "",
    installedAt: machine.installedAt ? machine.installedAt.slice(0, 10) : "",
    warrantyEndsAt: machine.warrantyEndsAt ? machine.warrantyEndsAt.slice(0, 10) : "",
    notes: machine.notes ?? "",
  };
}

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

export default function MakineDuzenlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<MachineFormData>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof MachineFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: machine, isLoading, isError } = useQuery<Machine>({
    queryKey: ["machines", id],
    queryFn: () => fetch(`/api/machines/${id}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (machine) {
      setValues(toFormValues(machine));
    }
  }, [machine]);

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
      fetch(`/api/machines/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Makine güncellenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["machines", id] });
      router.push(`/makineler/${id}`);
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

  if (isError || !machine) {
    return <div className="py-20 text-center text-destructive text-sm">Makine bulunamadı.</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link
          href={`/makineler/${id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Detay
        </Link>
        <h1 className="text-2xl font-semibold">Makine Düzenle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{machine.name}</CardTitle>
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
            onCancel={() => router.push(`/makineler/${id}`)}
            errors={errors}
            isPending={mutation.isPending}
            submitLabel="Kaydet"
          />
        </CardContent>
      </Card>
    </div>
  );
}
