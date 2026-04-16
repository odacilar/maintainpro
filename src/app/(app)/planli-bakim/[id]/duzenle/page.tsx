"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  frequencyLabel,
  priorityLabel,
  PM_FREQUENCIES,
  PM_PRIORITIES,
  intervalDaysToFrequency,
  parsePriority,
} from "@/lib/pm-helpers";
import type { PmFrequency, PmPriority } from "@/lib/validations/pm-plan";
import type { Machine } from "@/types/machine";

interface TechnicianUser {
  id: string;
  name: string | null;
  email: string;
}

interface PmPlanDetail {
  id: string;
  name: string;
  machineId: string;
  machine: { id: string; name: string; code: string };
  maintenanceType: string;
  intervalDays: number;
  isActive: boolean;
  estimatedDurationMinutes: number | null;
  taskList: string[];
}

interface FormValues {
  title: string;
  machineId: string;
  frequency: PmFrequency;
  priority: PmPriority;
  estimatedMinutes: string;
  assigneeId: string;
  instructions: string;
  isActive: boolean;
}

export default function PlanDuzenlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: plan, isLoading, isError } = useQuery<PmPlanDetail>({
    queryKey: ["pm-plans", id],
    queryFn: () => fetch(`/api/pm-plans/${id}`).then((r) => r.json()),
  });

  const { data: machines } = useQuery<Machine[]>({
    queryKey: ["machines"],
    queryFn: () => fetch("/api/machines").then((r) => r.json()),
  });

  const { data: technicians } = useQuery<TechnicianUser[]>({
    queryKey: ["technicians"],
    queryFn: () => fetch("/api/users/technicians").then((r) => r.json()),
  });

  useEffect(() => {
    if (!plan || values !== null) return;
    setValues({
      title: plan.name,
      machineId: plan.machineId,
      frequency: intervalDaysToFrequency(plan.intervalDays),
      priority: parsePriority(plan.maintenanceType) as PmPriority,
      estimatedMinutes: plan.estimatedDurationMinutes?.toString() ?? "",
      assigneeId: "",
      instructions: plan.taskList.join("\n"),
      isActive: plan.isActive,
    });
  }, [plan, values]);

  function handleChange<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => (prev ? { ...prev, [field]: value } : prev));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    if (!values) return false;
    const newErrors: Partial<Record<keyof FormValues, string>> = {};
    if (!values.title.trim()) newErrors.title = "Plan adı zorunludur.";
    if (!values.machineId) newErrors.machineId = "Makine seçimi zorunludur.";
    if (values.estimatedMinutes && isNaN(Number(values.estimatedMinutes))) {
      newErrors.estimatedMinutes = "Geçerli bir süre giriniz.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const mutation = useMutation<unknown, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetch(`/api/pm-plans/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Plan güncellenemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      router.push(`/planli-bakim/${id}`);
    },
    onError: (err) => {
      setServerError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate() || !values) return;

    const payload: Record<string, unknown> = {
      title: values.title.trim(),
      machineId: values.machineId,
      frequency: values.frequency,
      priority: values.priority,
      isActive: values.isActive,
    };
    if (values.estimatedMinutes) {
      payload.estimatedMinutes = Number(values.estimatedMinutes);
    }
    if (values.assigneeId) {
      payload.assigneeId = values.assigneeId;
    }
    if (values.instructions.trim()) {
      payload.instructions = values.instructions.trim();
    }

    mutation.mutate(payload);
  }

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !plan) {
    return <div className="py-20 text-center text-destructive text-sm">Plan bulunamadı.</div>;
  }

  if (!values) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Hazırlanıyor...</div>;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link
          href={`/planli-bakim/${id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Plan Detayı
        </Link>
        <h1 className="text-2xl font-semibold">Planı Düzenle</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">
                Plan Adı <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={values.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

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
                <Label htmlFor="frequency">Frekans</Label>
                <Select
                  id="frequency"
                  value={values.frequency}
                  onChange={(e) => handleChange("frequency", e.target.value as PmFrequency)}
                  className="h-12 text-base"
                >
                  {PM_FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {frequencyLabel(f)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Öncelik</Label>
                <Select
                  id="priority"
                  value={values.priority}
                  onChange={(e) => handleChange("priority", e.target.value as PmPriority)}
                  className="h-12 text-base"
                >
                  {PM_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {priorityLabel(p)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedMinutes">Tahmini Süre (dk)</Label>
                <Input
                  id="estimatedMinutes"
                  type="number"
                  min="1"
                  value={values.estimatedMinutes}
                  onChange={(e) => handleChange("estimatedMinutes", e.target.value)}
                  className="h-12 text-base"
                />
                {errors.estimatedMinutes && (
                  <p className="text-xs text-destructive">{errors.estimatedMinutes}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigneeId">Sorumlu (opsiyonel)</Label>
                <Select
                  id="assigneeId"
                  value={values.assigneeId}
                  onChange={(e) => handleChange("assigneeId", e.target.value)}
                  className="h-12 text-base"
                >
                  <option value="">Seçiniz</option>
                  {technicians?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name ?? t.email}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Talimatlar</Label>
              <Textarea
                id="instructions"
                rows={4}
                value={values.instructions}
                onChange={(e) => handleChange("instructions", e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="rounded"
              />
              Aktif (iş emirleri otomatik oluşturulsun)
            </label>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 sm:flex-none h-12 text-base"
              >
                {mutation.isPending ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/planli-bakim/${id}`)}
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
