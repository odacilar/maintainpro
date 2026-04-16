"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import {
  periodLabel,
  itemTypeLabel,
  recordStatusLabel,
  recordStatusVariant,
} from "@/lib/checklist-helpers";
import { formatDateTime } from "@/lib/breakdown-helpers";
import type { ChecklistTemplate, ChecklistRecord } from "@/types/checklist";

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

const ROLE_LABELS: Record<string, string> = {
  TECHNICIAN: "Teknisyen",
  ENGINEER: "Mühendis",
  FACTORY_ADMIN: "Fabrika Yöneticisi",
};

export default function SablonDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: template, isLoading, isError } = useQuery<ChecklistTemplate>({
    queryKey: ["checklist-templates", id],
    queryFn: () => fetch(`/api/checklists/templates/${id}`).then((r) => r.json()),
  });

  const { data: records, isLoading: recordsLoading } = useQuery<ChecklistRecord[]>({
    queryKey: ["checklist-records", { templateId: id }],
    queryFn: () =>
      fetch(`/api/checklists/records?templateId=${id}&limit=20`).then((r) => r.json()),
  });

  const deleteMutation = useMutation<void, Error>({
    mutationFn: () =>
      fetch(`/api/checklists/templates/${id}`, { method: "DELETE" }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Şablon silinemedi.");
        }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      router.push("/otonom-bakim");
    },
  });

  if (isLoading) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  if (isError || !template) {
    return (
      <div className="py-20 text-center text-destructive text-sm">Şablon bulunamadı.</div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/otonom-bakim" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Otonom Bakım
        </Link>
        <h1 className="text-2xl font-semibold flex-1">{template.name}</h1>
        <Badge variant={template.isActive ? "success" : "secondary"}>
          {template.isActive ? "Aktif" : "Pasif"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <CardTitle className="text-base">Şablon Bilgileri</CardTitle>
              <div className="flex gap-2">
                <Link
                  href={`/otonom-bakim/sablonlar/${id}/duzenle`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Düzenle
                </Link>
                {!showDeleteConfirm ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Sil
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-destructive">Emin misiniz?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Siliniyor..." : "Evet, Sil"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleteMutation.isPending}
                    >
                      İptal
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <FieldRow label="Makine" value={template.machine?.name ?? "—"} />
              <FieldRow
                label="Makine Kodu"
                value={
                  <span className="font-mono text-xs">{template.machine?.code ?? "—"}</span>
                }
              />
              <FieldRow label="Periyot" value={periodLabel(template.period)} />
              <FieldRow
                label="Atanan Roller"
                value={
                  <span>
                    {template.assignedRoles.map((r) => ROLE_LABELS[r] ?? r).join(", ")}
                  </span>
                }
              />
              <FieldRow
                label="Toplam Madde"
                value={`${template._count?.items ?? template.items.length} madde`}
              />
              <FieldRow
                label="Toplam Kayıt"
                value={`${template._count?.records ?? 0} kayıt`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Kontrol Maddeleri ({template.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {template.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Madde eklenmemiş.</p>
            ) : (
              [...template.items]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 py-2 border-b last:border-0"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 mt-0.5">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {itemTypeLabel(item.type)}
                        </Badge>
                        {item.photoRequired && (
                          <Badge variant="outline" className="text-xs">
                            Fotoğraf Zorunlu
                          </Badge>
                        )}
                        {item.referenceValue && (
                          <span className="text-xs text-muted-foreground">
                            Ref: {item.referenceValue}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Kontrol Kayıtları</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recordsLoading && (
            <div className="py-10 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          )}
          {!recordsLoading && (!records || records.length === 0) && (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Henüz kayıt yok.
            </div>
          )}
          {!recordsLoading && records && records.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Planlanan
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Durum
                    </th>
                    <th className="hidden sm:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Kullanıcı
                    </th>
                    <th className="hidden md:table-cell px-4 py-3 text-left font-medium text-muted-foreground">
                      Tamamlandı
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(record.scheduledFor)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={recordStatusVariant(record.status)}>
                          {recordStatusLabel(record.status)}
                        </Badge>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                        {record.user?.name ?? record.user?.email ?? "—"}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-xs text-muted-foreground">
                        {record.completedAt ? formatDateTime(record.completedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {record.status === "pending" || record.status === "in_progress" ? (
                          <Link
                            href={`/otonom-bakim/kontrol/${record.id}`}
                            className={buttonVariants({ variant: "default", size: "sm" })}
                          >
                            {record.status === "pending" ? "Başla" : "Devam Et"}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
