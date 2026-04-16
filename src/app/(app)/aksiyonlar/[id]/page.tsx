"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Camera } from "lucide-react";
import {
  actionStatusLabel,
  actionStatusVariant,
  actionPriorityLabel,
  actionPriorityVariant,
} from "@/lib/checklist-helpers";
import { formatDateTime } from "@/lib/breakdown-helpers";
import type { Action } from "@/types/checklist";

interface Technician {
  id: string;
  name: string | null;
  email: string;
}

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium">
        {value ?? <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function TransitionError({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

export default function AksiyonDetayPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [showCompletePanel, setShowCompletePanel] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: action, isLoading, isError } = useQuery<Action>({
    queryKey: ["actions", id],
    queryFn: () => fetch(`/api/actions/${id}`).then((r) => r.json()),
  });

  const { data: technicians } = useQuery<Technician[]>({
    queryKey: ["technicians"],
    queryFn: () => fetch("/api/users/technicians").then((r) => r.json()),
    enabled: showAssignPanel,
  });

  const transitionMutation = useMutation<Action, Error, { status: string; [key: string]: unknown }>({
    mutationFn: (payload) =>
      fetch(`/api/actions/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "İşlem gerçekleştirilemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["actions", id] });
      setShowAssignPanel(false);
      setShowCompletePanel(false);
      setTransitionError(null);
    },
    onError: (err) => {
      setTransitionError(err.message);
    },
  });

  const updateMutation = useMutation<Action, Error, Record<string, unknown>>({
    mutationFn: (data) =>
      fetch(`/api/actions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Güncelleme gerçekleştirilemedi.");
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["actions", id] });
      setShowAssignPanel(false);
      setTransitionError(null);
    },
    onError: (err) => {
      setTransitionError(err.message);
    },
  });

  const role = (session?.user as { role?: string } | undefined)?.role;
  const isEngineerOrAdmin =
    role === "ENGINEER" || role === "FACTORY_ADMIN" || role === "SUPER_ADMIN";
  const isTechnician = role === "TECHNICIAN";

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !action) {
    return (
      <div className="py-20 text-center text-destructive text-sm">Aksiyon bulunamadı.</div>
    );
  }

  const status = action.status;

  function handleAssign() {
    if (!selectedAssignee) return;
    setTransitionError(null);
    updateMutation.mutate({
      assigneeId: selectedAssignee,
      targetDate: targetDate || null,
      status: "IN_PROGRESS",
    });
  }

  function handleStart() {
    setTransitionError(null);
    transitionMutation.mutate({ status: "IN_PROGRESS" });
  }

  function handleComplete() {
    if (!resolutionNotes.trim()) {
      setTransitionError("Çözüm açıklaması zorunludur.");
      return;
    }
    setTransitionError(null);
    transitionMutation.mutate({
      status: "COMPLETED",
      resolutionNotes: resolutionNotes.trim(),
    });
  }

  function handleVerify() {
    setTransitionError(null);
    transitionMutation.mutate({ status: "VERIFIED" });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/aksiyonlar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Aksiyonlar
        </Link>
        <h1 className="text-2xl font-semibold flex-1 font-mono">{action.code}</h1>
        <div className="flex gap-2 items-center">
          <Badge variant={actionPriorityVariant(action.priority)}>
            {actionPriorityLabel(action.priority)}
          </Badge>
          <Badge variant={actionStatusVariant(action.status)}>
            {actionStatusLabel(action.status)}
          </Badge>
        </div>
      </div>

      {transitionError && <TransitionError message={transitionError} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Aksiyon Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FieldRow
                label="Kaynak Kontrol Listesi"
                value={
                  action.record ? (
                    <span>{action.record.template?.name ?? "—"}</span>
                  ) : null
                }
              />
              <FieldRow
                label="Atanan Kişi"
                value={action.assignee?.name ?? null}
              />
              <FieldRow
                label="Hedef Tarih"
                value={action.targetDate ? formatDateTime(action.targetDate) : null}
              />
              <FieldRow
                label="Oluşturulma"
                value={formatDateTime(action.createdAt)}
              />
            </div>

            <div className="mt-6 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Anormallik Açıklaması
              </p>
              <p className="text-sm whitespace-pre-wrap">{action.description}</p>
            </div>

            {action.resolutionNotes && (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Çözüm Notları
                </p>
                <p className="text-sm whitespace-pre-wrap">{action.resolutionNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İşlemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === "OPEN" && isTechnician && (
              <Button
                className="w-full"
                onClick={handleStart}
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? "İşleniyor..." : "Başla"}
              </Button>
            )}

            {status === "OPEN" && isEngineerOrAdmin && (
              <>
                {!showAssignPanel ? (
                  <Button className="w-full" onClick={() => setShowAssignPanel(true)}>
                    Ata
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="assignee">Kişi Seç</Label>
                      <Select
                        id="assignee"
                        value={selectedAssignee}
                        onChange={(e) => setSelectedAssignee(e.target.value)}
                      >
                        <option value="">Seçiniz</option>
                        {technicians?.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name ?? t.email}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="targetDate">Hedef Tarih</Label>
                      <Input
                        id="targetDate"
                        type="datetime-local"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAssign}
                        disabled={!selectedAssignee || updateMutation.isPending}
                      >
                        {updateMutation.isPending ? "Atanıyor..." : "Ata"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAssignPanel(false)}
                        disabled={updateMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === "IN_PROGRESS" && (
              <>
                {!showCompletePanel ? (
                  <Button className="w-full" onClick={() => setShowCompletePanel(true)}>
                    Tamamla
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <Label htmlFor="resolutionNotes">
                      Çözüm Açıklaması <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="resolutionNotes"
                      rows={4}
                      placeholder="Yapılan işlemleri açıklayın..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleComplete}
                        disabled={transitionMutation.isPending}
                      >
                        {transitionMutation.isPending ? "Kaydediliyor..." : "Tamamla"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCompletePanel(false)}
                        disabled={transitionMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === "COMPLETED" && isEngineerOrAdmin && (
              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? "İşleniyor..." : "Doğrula"}
              </Button>
            )}

            {status === "VERIFIED" && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Bu aksiyon doğrulanmış ve kapatılmıştır.
              </p>
            )}

            {status === "COMPLETED" && !isEngineerOrAdmin && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Mühendis veya yönetici doğrulaması bekleniyor.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fotoğraflar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center space-y-2">
              <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">Önce Fotoğraf</p>
              <p className="text-xs text-muted-foreground">Sprint 6 ile etkinleştirilecek</p>
            </div>
            <div className="rounded-lg border-2 border-dashed border-border p-6 text-center space-y-2">
              <Camera className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">Sonra Fotoğraf</p>
              <p className="text-xs text-muted-foreground">Sprint 6 ile etkinleştirilecek</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {action.itemResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kaynak Kontrol Maddesi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                {action.itemResponse.item?.title ?? "Kontrol maddesi"}
              </p>
              {action.itemResponse.note && (
                <p className="text-sm text-amber-700">{action.itemResponse.note}</p>
              )}
              {action.itemResponse.valueNumber != null && (
                <p className="text-xs text-amber-600">
                  Ölçüm: {action.itemResponse.valueNumber}
                  {action.itemResponse.item?.referenceValue && (
                    <span> (Ref: {action.itemResponse.item.referenceValue})</span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
