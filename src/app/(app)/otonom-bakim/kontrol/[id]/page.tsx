"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/breakdown-helpers";
import { recordStatusLabel, recordStatusVariant, itemTypeLabel } from "@/lib/checklist-helpers";
import type { ChecklistRecord, ChecklistItem, ItemResponse, Action } from "@/types/checklist";

interface ResponseDraft {
  itemId: string;
  valueBool: boolean | null;
  valueNumber: string;
  valueText: string;
  isAbnormal: boolean;
  note: string;
}

function buildInitialDrafts(items: ChecklistItem[]): Record<string, ResponseDraft> {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        itemId: item.id,
        valueBool: null,
        valueNumber: "",
        valueText: "",
        isAbnormal: false,
        note: "",
      },
    ])
  );
}

function YesNoInput({
  value,
  isAbnormal,
  onValue,
  onAbnormal,
}: {
  value: boolean | null;
  isAbnormal: boolean;
  onValue: (v: boolean) => void;
  onAbnormal: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => {
          onValue(true);
          onAbnormal(false);
        }}
        className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-4 text-base font-semibold transition-colors ${
          value === true && !isAbnormal
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-border bg-background text-foreground hover:border-green-300"
        }`}
      >
        <CheckCircle2 className="h-5 w-5" />
        Normal
      </button>
      <button
        type="button"
        onClick={() => {
          onValue(false);
          onAbnormal(true);
        }}
        className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-4 text-base font-semibold transition-colors ${
          isAbnormal
            ? "border-red-500 bg-red-50 text-red-700"
            : "border-border bg-background text-foreground hover:border-red-300"
        }`}
      >
        <AlertTriangle className="h-5 w-5" />
        Anormal
      </button>
    </div>
  );
}

export default function KontrolTamamlaPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState<Record<string, ResponseDraft>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [createdActions, setCreatedActions] = useState<Action[]>([]);

  const { data: record, isLoading, isError } = useQuery<ChecklistRecord>({
    queryKey: ["checklist-records", id],
    queryFn: () =>
      fetch(`/api/checklists/records/${id}`).then((r) => r.json()),
  });

  useEffect(() => {
    if (!record?.template?.items) return;
    setDrafts((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const initial = buildInitialDrafts(record.template!.items);
      // Pre-fill existing responses
      if (record.responses) {
        for (const resp of record.responses) {
          if (initial[resp.itemId]) {
            initial[resp.itemId] = {
              itemId: resp.itemId,
              valueBool: resp.valueBool ?? null,
              valueNumber: resp.valueNumber?.toString() ?? "",
              valueText: resp.valueText ?? "",
              isAbnormal: resp.isAbnormal,
              note: resp.note ?? "",
            };
          }
        }
      }
      return initial;
    });
  }, [record]);

  const startMutation = useMutation<ChecklistRecord, Error>({
    mutationFn: () =>
      fetch(`/api/checklists/records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Kontrol başlatılamadı.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-records", id] });
    },
  });

  const submitMutation = useMutation<
    { record: ChecklistRecord; actions: Action[] },
    Error,
    { responses: ItemResponse[] }
  >({
    mutationFn: (data) =>
      fetch(`/api/checklists/records/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", responses: data.responses }),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Kontrol tamamlanamadı.");
        }
        return r.json();
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["checklist-records"] });
      queryClient.invalidateQueries({ queryKey: ["checklist-records", id] });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setCreatedActions(data.actions ?? []);
      setSubmitted(true);
    },
    onError: (err) => {
      setSubmitError(err.message);
    },
  });

  const updateDraft = useCallback(
    (itemId: string, field: keyof ResponseDraft, value: boolean | null | string) => {
      setDrafts((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], [field]: value },
      }));
    },
    []
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const items = record?.template?.items ?? [];
    for (const item of items) {
      const draft = drafts[item.id];
      if (!draft) continue;
      if (draft.isAbnormal && !draft.note.trim()) {
        setSubmitError(`"${item.title}" maddesi anormal işaretlendi — açıklama zorunludur.`);
        return;
      }
      if (item.type === "MEASUREMENT" && !draft.valueNumber) {
        setSubmitError(`"${item.title}" için ölçüm değeri giriniz.`);
        return;
      }
    }

    const responses = items.map((item) => {
      const draft = drafts[item.id] ?? {
        itemId: item.id,
        valueBool: null,
        valueNumber: "",
        valueText: "",
        isAbnormal: false,
        note: "",
      };
      return {
        itemId: item.id,
        valueBool: item.type === "YES_NO" ? draft.valueBool : null,
        valueNumber:
          item.type === "MEASUREMENT" && draft.valueNumber
            ? Number(draft.valueNumber)
            : null,
        valueText:
          item.type === "MULTIPLE_CHOICE" || item.type === "PHOTO"
            ? draft.valueText || null
            : null,
        isAbnormal: draft.isAbnormal,
        note: draft.note.trim() || null,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    submitMutation.mutate({ responses: responses as any });
  }

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !record) {
    return (
      <div className="py-20 text-center text-destructive text-sm">
        Kontrol kaydı bulunamadı.
      </div>
    );
  }

  const items = record.template?.items
    ? [...record.template.items].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  const isCompleted = record.status === "completed";

  // Success screen
  if (submitted || isCompleted) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link
            href="/otonom-bakim/gunluk"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Görevlerim
          </Link>
        </div>
        <Card className="text-center">
          <CardContent className="pt-10 pb-10 space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Kontrol Tamamlandı!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {record.template?.name} — {record.machine?.name}
              </p>
            </div>
            {createdActions.length > 0 && (
              <div className="text-left rounded-md border border-amber-200 bg-amber-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-800">
                  {createdActions.length} anormal madde için aksiyon oluşturuldu:
                </p>
                <ul className="space-y-1">
                  {createdActions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-amber-700 font-mono">{a.code}</span>
                      <Link
                        href={`/aksiyonlar/${a.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Görüntüle
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Link
              href="/otonom-bakim/gunluk"
              className={buttonVariants({ size: "lg" })}
            >
              Görev Listesine Dön
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const needsStart = record.status === "pending";

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-24">
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/otonom-bakim/gunluk"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Görevlerim
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{record.template?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {record.machine?.name}{" "}
            <span className="font-mono text-xs">({record.machine?.code})</span>
          </p>
        </div>
        <Badge variant={recordStatusVariant(record.status)}>
          {recordStatusLabel(record.status)}
        </Badge>
      </div>

      <div className="text-sm text-muted-foreground">
        Planlanan: {formatDateTime(record.scheduledFor)}
      </div>

      {needsStart ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Kontrolü başlatmak için aşağıdaki butona tıklayın.
            </p>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? "Başlatılıyor..." : "Başla"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          {items.map((item, index) => {
            const draft = drafts[item.id] ?? {
              itemId: item.id,
              valueBool: null,
              valueNumber: "",
              valueText: "",
              isAbnormal: false,
              note: "",
            };

            return (
              <Card key={item.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-xs font-mono font-bold text-muted-foreground shrink-0">
                      {index + 1}/{items.length}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {itemTypeLabel(item.type)}
                        </Badge>
                        {item.photoRequired && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Camera className="h-3 w-3" />
                            Fotoğraf Zorunlu
                          </Badge>
                        )}
                        {item.referenceValue && (
                          <span className="text-xs text-muted-foreground">
                            Referans: {item.referenceValue}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.type === "YES_NO" && (
                    <YesNoInput
                      value={draft.valueBool}
                      isAbnormal={draft.isAbnormal}
                      onValue={(v) => updateDraft(item.id, "valueBool", v)}
                      onAbnormal={(v) => updateDraft(item.id, "isAbnormal", v)}
                    />
                  )}

                  {item.type === "MEASUREMENT" && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`measure-${item.id}`}>
                          Ölçüm Değeri <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`measure-${item.id}`}
                          type="number"
                          step="any"
                          placeholder={item.referenceValue ?? "Değer girin"}
                          value={draft.valueNumber}
                          onChange={(e) => updateDraft(item.id, "valueNumber", e.target.value)}
                          className="text-lg h-12"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isAbnormal}
                          onChange={(e) => updateDraft(item.id, "isAbnormal", e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-amber-700 font-medium">Anormal işaretle</span>
                      </label>
                    </div>
                  )}

                  {item.type === "PHOTO" && (
                    <div className="space-y-3">
                      <div className="rounded-lg border-2 border-dashed border-border p-6 text-center space-y-2">
                        <Camera className="h-8 w-8 mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Fotoğraf yükleme Sprint 6 ile etkinleştirilecek.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isAbnormal}
                          onChange={(e) => updateDraft(item.id, "isAbnormal", e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-amber-700 font-medium">Anormal işaretle</span>
                      </label>
                    </div>
                  )}

                  {item.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {(item.meta?.choices ?? []).map((choice) => (
                          <label
                            key={choice}
                            className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                          >
                            <input
                              type="radio"
                              name={`choice-${item.id}`}
                              value={choice}
                              checked={draft.valueText === choice}
                              onChange={() => updateDraft(item.id, "valueText", choice)}
                              className="shrink-0"
                            />
                            <span className="text-sm">{choice}</span>
                          </label>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={draft.isAbnormal}
                          onChange={(e) => updateDraft(item.id, "isAbnormal", e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-amber-700 font-medium">Anormal işaretle</span>
                      </label>
                    </div>
                  )}

                  {draft.isAbnormal && (
                    <div className="space-y-1.5 rounded-md bg-red-50 border border-red-200 p-3">
                      <Label
                        htmlFor={`note-${item.id}`}
                        className="text-red-700 text-xs font-semibold"
                      >
                        Anormallik Açıklaması <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id={`note-${item.id}`}
                        rows={2}
                        placeholder="Anormalliği açıklayın... (aksiyon otomatik oluşturulacak)"
                        value={draft.note}
                        onChange={(e) => updateDraft(item.id, "note", e.target.value)}
                        className="border-red-300 focus-visible:ring-red-400"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <div className="sticky bottom-4">
            <Button
              type="submit"
              size="lg"
              className="w-full shadow-lg"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Gönderiliyor..." : "Kontrol Tamamla"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
