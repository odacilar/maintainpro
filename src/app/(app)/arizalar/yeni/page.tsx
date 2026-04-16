"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import {
  typeLabel,
  priorityLabel,
  BREAKDOWN_TYPES,
  BREAKDOWN_PRIORITIES,
} from "@/lib/breakdown-helpers";
import type { Machine } from "@/types/machine";
import type { Breakdown, BreakdownCreatePayload, BreakdownType, BreakdownPriority } from "@/types/breakdown";

interface FormValues {
  machineId: string;
  type: BreakdownType | "";
  priority: BreakdownPriority | "";
  description: string;
}

const defaultValues: FormValues = {
  machineId: "",
  type: "",
  priority: "",
  description: "",
};

export default function ArizaBildirPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const preselectedMachineId = searchParams.get("machineId") ?? "";

  const [values, setValues] = useState<FormValues>({
    ...defaultValues,
    machineId: preselectedMachineId,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof FormValues, string>> = {};
    if (!values.machineId) newErrors.machineId = "Makine seçimi zorunludur.";
    if (!values.type) newErrors.type = "Arıza tipi zorunludur.";
    if (!values.priority) newErrors.priority = "Öncelik zorunludur.";
    if (!values.description.trim()) {
      newErrors.description = "Açıklama zorunludur.";
    } else if (values.description.trim().length < 10) {
      newErrors.description = "Açıklama en az 10 karakter olmalıdır.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const mutation = useMutation<Breakdown, Error, BreakdownCreatePayload>({
    mutationFn: (data) =>
      fetch("/api/breakdowns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Arıza kaydedilemedi.");
        }
        return r.json();
      }),
    onSuccess: (breakdown) => {
      queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
      router.push(`/arizalar/${breakdown.id}`);
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
      machineId: values.machineId,
      type: values.type as BreakdownType,
      priority: values.priority as BreakdownPriority,
      description: values.description.trim(),
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/arizalar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Arızalar
        </Link>
        <h1 className="text-2xl font-semibold">Arıza Bildir</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arıza Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="machineId">
                Makine <span className="text-destructive">*</span>
              </Label>
              <Select
                id="machineId"
                value={values.machineId}
                onChange={(e) => handleChange("machineId", e.target.value)}
                className="h-12 text-base"
              >
                <option value="">Makine seçiniz</option>
                {machines?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.code}
                  </option>
                ))}
              </Select>
              {errors.machineId && (
                <p className="text-xs text-destructive">{errors.machineId}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">
                  Arıza Tipi <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="type"
                  value={values.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                  className="h-12 text-base"
                >
                  <option value="">Tip seçiniz</option>
                  {BREAKDOWN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {typeLabel(t)}
                    </option>
                  ))}
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">
                  Öncelik <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="priority"
                  value={values.priority}
                  onChange={(e) => handleChange("priority", e.target.value)}
                  className="h-12 text-base"
                >
                  <option value="">Öncelik seçiniz</option>
                  {BREAKDOWN_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel(p)}
                    </option>
                  ))}
                </Select>
                {errors.priority && (
                  <p className="text-xs text-destructive">{errors.priority}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Açıklama <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Arızayı ayrıntılı açıklayın... (en az 10 karakter)"
                rows={5}
                value={values.description}
                onChange={(e) => handleChange("description", e.target.value)}
                className="text-base resize-none"
              />
              <div className="flex items-center justify-between">
                {errors.description ? (
                  <p className="text-xs text-destructive">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {values.description.length} karakter
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 sm:flex-none h-12 text-base"
              >
                {mutation.isPending ? "Kaydediliyor..." : "Arıza Bildir"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/arizalar")}
                disabled={mutation.isPending}
                className="h-12 text-base"
              >
                İptal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
