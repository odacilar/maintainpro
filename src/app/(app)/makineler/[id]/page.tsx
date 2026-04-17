"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, Download, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PhotoUpload } from "@/components/ui/photo-upload";
import type { Machine, MachineStatus, MachineCriticality } from "@/types/machine";

function statusBadge(status: MachineStatus) {
  switch (status) {
    case "RUNNING":
      return <Badge variant="success">Çalışıyor</Badge>;
    case "BROKEN":
      return <Badge variant="danger">Arızalı</Badge>;
    case "IN_MAINTENANCE":
      return <Badge variant="warning">Bakımda</Badge>;
    case "DECOMMISSIONED":
      return <Badge variant="secondary">Devre Dışı</Badge>;
  }
}

function criticalityBadge(criticality: MachineCriticality) {
  switch (criticality) {
    case "A":
      return <Badge variant="danger">Kritik (A)</Badge>;
    case "B":
      return <Badge variant="warning">Önemli (B)</Badge>;
    case "C":
      return <Badge className="border-transparent bg-blue-100 text-blue-800">Destek (C)</Badge>;
  }
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface FieldRowProps {
  label: string;
  value: React.ReactNode;
}

function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default function MakineDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: machine, isLoading, isError } = useQuery<Machine>({
    queryKey: ["machines", id],
    queryFn: () => fetch(`/api/machines/${id}`).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/machines/${id}`, { method: "DELETE" }).then((r) => {
        if (!r.ok) throw new Error("Silinemedi");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      router.push("/makineler");
    },
  });

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>
    );
  }

  if (isError || !machine) {
    return (
      <div className="py-20 text-center text-destructive text-sm">Makine bulunamadı.</div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/makineler" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Makineler
        </Link>
        <h1 className="text-2xl font-semibold flex-1">{machine.name}</h1>
        <div className="flex gap-2">
          <Link
            href={`/makineler/${id}/duzenle`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Edit className="h-4 w-4 mr-1" />
            Düzenle
          </Link>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Sil
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-destructive">
            Bu makineyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
          </p>
          <div className="flex gap-2">
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
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
            >
              İptal
            </Button>
          </div>
          {deleteMutation.isError && (
            <p className="text-xs text-destructive">Silme işlemi başarısız oldu.</p>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Makine Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <FieldRow label="Makine Kodu" value={<span className="font-mono">{machine.code}</span>} />
              <FieldRow label="Makine Adı" value={machine.name} />
              <FieldRow label="Departman" value={machine.department?.name ?? "—"} />
              <FieldRow label="Hat/Bölge" value={machine.line} />
              <FieldRow label="Durum" value={statusBadge(machine.status)} />
              <FieldRow label="Kritiklik" value={criticalityBadge(machine.criticality)} />
              <FieldRow label="Marka" value={machine.brand} />
              <FieldRow label="Model" value={machine.model} />
              <FieldRow label="Seri No" value={machine.serialNumber} />
              <FieldRow label="Kurulum Tarihi" value={formatDate(machine.installedAt)} />
              <FieldRow label="Garanti Bitiş" value={formatDate(machine.warrantyEndsAt)} />
            </div>
            {machine.notes && (
              <div className="mt-6 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notlar
                </p>
                <p className="text-sm whitespace-pre-wrap">{machine.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">QR Kod</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/machines/${id}/qr`}
                alt={`QR: ${machine.code}`}
                width={160}
                height={160}
                className="rounded-md border"
              />
              <p className="text-xs text-muted-foreground text-center font-mono">{machine.code}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `/api/machines/${id}/qr`;
                    a.download = `qr-${machine.code}.png`;
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  İndir
                </Button>
                <Link
                  href={`/makineler/${id}/etiket`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Etiket
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Photos section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fotoğraflar</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUpload referenceType="MACHINE" referenceId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
