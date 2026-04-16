"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { PhotoUpload } from "@/components/ui/photo-upload";
import {
  statusLabel,
  statusVariant,
  priorityLabel,
  priorityVariant,
  typeLabel,
  formatDateTime,
  formatDowntime,
} from "@/lib/breakdown-helpers";
import type { Breakdown, BreakdownUser, BreakdownTransitionPayload } from "@/types/breakdown";

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium">{value ?? <span className="text-muted-foreground">—</span>}</div>
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

export default function ArizaDetayPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [showResolvePanel, setShowResolvePanel] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const { data: breakdown, isLoading, isError } = useQuery<Breakdown>({
    queryKey: ["breakdowns", id],
    queryFn: () => fetch(`/api/breakdowns/${id}`).then((r) => r.json()),
  });

  const { data: technicians } = useQuery<BreakdownUser[]>({
    queryKey: ["technicians"],
    queryFn: () => fetch("/api/users/technicians").then((r) => r.json()),
    enabled: showAssignPanel,
  });

  const transitionMutation = useMutation<Breakdown, Error, BreakdownTransitionPayload>({
    mutationFn: (payload) =>
      fetch(`/api/breakdowns/${id}/transition`, {
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
      queryClient.invalidateQueries({ queryKey: ["breakdowns"] });
      queryClient.invalidateQueries({ queryKey: ["breakdowns", id] });
      setShowAssignPanel(false);
      setShowResolvePanel(false);
      setShowRejectPanel(false);
      setTransitionError(null);
    },
    onError: (err) => {
      setTransitionError(err.message);
    },
  });

  const role = (session?.user as { role?: string } | undefined)?.role;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isEngineerOrAdmin = role === "ENGINEER" || role === "FACTORY_ADMIN" || role === "SUPER_ADMIN";
  const isTechnician = role === "TECHNICIAN";
  const isAssignedTechnician = isTechnician && breakdown?.assigneeId === userId;

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>
    );
  }

  if (isError || !breakdown) {
    return (
      <div className="py-20 text-center text-destructive text-sm">Arıza kaydı bulunamadı.</div>
    );
  }

  const status = breakdown.status;

  function handleAssign() {
    if (!selectedAssignee) return;
    setTransitionError(null);
    transitionMutation.mutate({ status: "ASSIGNED", assigneeId: selectedAssignee });
  }

  function handleTransition(payload: BreakdownTransitionPayload) {
    setTransitionError(null);
    transitionMutation.mutate(payload);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/arizalar" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Arızalar
        </Link>
        <h1 className="text-2xl font-semibold flex-1 font-mono">{breakdown.code}</h1>
        <div className="flex gap-2 items-center">
          <Badge variant={priorityVariant(breakdown.priority)}>
            {priorityLabel(breakdown.priority)}
          </Badge>
          <Badge variant={statusVariant(breakdown.status)}>
            {statusLabel(breakdown.status)}
          </Badge>
        </div>
      </div>

      {transitionError && <TransitionError message={transitionError} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Arıza Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FieldRow
                label="Makine"
                value={
                  <Link
                    href={`/makineler/${breakdown.machineId}`}
                    className="text-primary hover:underline"
                  >
                    {breakdown.machine.name}{" "}
                    <span className="text-muted-foreground font-mono text-xs">
                      ({breakdown.machine.code})
                    </span>
                  </Link>
                }
              />
              <FieldRow label="Arıza Tipi" value={typeLabel(breakdown.type)} />
              <FieldRow
                label="Bildiren"
                value={breakdown.reporter.name ?? breakdown.reporter.email}
              />
              <FieldRow label="Bildirim Zamanı" value={formatDateTime(breakdown.reportedAt)} />
              <FieldRow
                label="Atanan Teknisyen"
                value={breakdown.assignee?.name ?? breakdown.assignee?.email ?? null}
              />
              {breakdown.resolvedAt && (
                <FieldRow label="Çözüm Zamanı" value={formatDateTime(breakdown.resolvedAt)} />
              )}
              {breakdown.downtimeMinutes != null && (
                <FieldRow
                  label="Duruş Süresi"
                  value={formatDowntime(breakdown.downtimeMinutes)}
                />
              )}
            </div>
            <div className="mt-6 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Açıklama
              </p>
              <p className="text-sm whitespace-pre-wrap">{breakdown.description}</p>
            </div>
            {breakdown.resolutionNotes && (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Çözüm Açıklaması
                </p>
                <p className="text-sm whitespace-pre-wrap">{breakdown.resolutionNotes}</p>
              </div>
            )}
            {breakdown.rootCause && (
              <div className="mt-4 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Kök Neden
                </p>
                <p className="text-sm whitespace-pre-wrap">{breakdown.rootCause}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">İşlemler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === "OPEN" && isEngineerOrAdmin && (
              <>
                {!showAssignPanel ? (
                  <Button
                    className="w-full"
                    onClick={() => setShowAssignPanel(true)}
                  >
                    Teknisyen Ata
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <Label htmlFor="assignee">Teknisyen Seç</Label>
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAssign}
                        disabled={!selectedAssignee || transitionMutation.isPending}
                      >
                        {transitionMutation.isPending ? "Atanıyor..." : "Ata"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAssignPanel(false)}
                        disabled={transitionMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === "ASSIGNED" && isAssignedTechnician && (
              <Button
                className="w-full"
                onClick={() => handleTransition({ status: "IN_PROGRESS" })}
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? "İşleniyor..." : "Müdahaleyi Başlat"}
              </Button>
            )}

            {status === "IN_PROGRESS" && isAssignedTechnician && (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleTransition({ status: "WAITING_PARTS" })}
                  disabled={transitionMutation.isPending}
                >
                  Parça Gerekli
                </Button>
                {!showResolvePanel ? (
                  <Button
                    className="w-full"
                    onClick={() => setShowResolvePanel(true)}
                  >
                    Çözüldü
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="resolutionNotes">Çözüm Açıklaması</Label>
                      <Textarea
                        id="resolutionNotes"
                        rows={3}
                        placeholder="Yapılan işlemleri açıklayın..."
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rootCause">Kök Neden</Label>
                      <Textarea
                        id="rootCause"
                        rows={2}
                        placeholder="Arızanın temel nedeni nedir?"
                        value={rootCause}
                        onChange={(e) => setRootCause(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          handleTransition({
                            status: "RESOLVED",
                            resolutionNotes: resolutionNotes.trim() || undefined,
                            rootCause: rootCause.trim() || undefined,
                          })
                        }
                        disabled={transitionMutation.isPending}
                      >
                        {transitionMutation.isPending ? "Kaydediliyor..." : "Tamamla"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowResolvePanel(false)}
                        disabled={transitionMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === "WAITING_PARTS" && isAssignedTechnician && (
              <Button
                className="w-full"
                onClick={() => handleTransition({ status: "IN_PROGRESS" })}
                disabled={transitionMutation.isPending}
              >
                {transitionMutation.isPending ? "İşleniyor..." : "Parça Geldi"}
              </Button>
            )}

            {status === "RESOLVED" && isEngineerOrAdmin && (
              <>
                <Button
                  className="w-full"
                  onClick={() => handleTransition({ status: "CLOSED" })}
                  disabled={transitionMutation.isPending}
                >
                  {transitionMutation.isPending ? "İşleniyor..." : "Onayla ve Kapat"}
                </Button>
                {!showRejectPanel ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowRejectPanel(true)}
                  >
                    Reddet
                  </Button>
                ) : (
                  <div className="space-y-3 rounded-md border p-3">
                    <Label htmlFor="rejectNote">Red Gerekçesi</Label>
                    <Textarea
                      id="rejectNote"
                      rows={3}
                      placeholder="Neden reddedildi?"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleTransition({
                            status: "IN_PROGRESS",
                            note: rejectNote.trim() || undefined,
                          })
                        }
                        disabled={transitionMutation.isPending}
                      >
                        {transitionMutation.isPending ? "İşleniyor..." : "Reddet"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowRejectPanel(false)}
                        disabled={transitionMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {status === "CLOSED" && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Bu arıza kapatılmıştır.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photos section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fotoğraflar</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUpload referenceType="BREAKDOWN" referenceId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zaman Çizelgesi</CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
          ) : (
            <div className="relative space-y-0">
              {[...breakdown.timeline]
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .map((entry, index, arr) => (
                  <div key={entry.id} className="flex gap-4 pb-6 relative">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-primary ring-2 ring-background ring-offset-1 mt-0.5 shrink-0" />
                      {index < arr.length - 1 && (
                        <div className="flex-1 w-px bg-border mt-1" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {entry.user.name ?? entry.user.email}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {entry.fromStatus && (
                            <>
                              <Badge variant={statusVariant(entry.fromStatus)} className="text-xs">
                                {statusLabel(entry.fromStatus)}
                              </Badge>
                              <span>→</span>
                            </>
                          )}
                          <Badge variant={statusVariant(entry.toStatus)} className="text-xs">
                            {statusLabel(entry.toStatus)}
                          </Badge>
                        </div>
                      </div>
                      {entry.note && (
                        <p className="text-sm text-muted-foreground">{entry.note}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
