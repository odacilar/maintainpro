"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import type { Machine } from "@/types/machine";

export default function MakineEtiketPage() {
  const { id } = useParams<{ id: string }>();

  const { data: machine, isLoading } = useQuery<Machine>({
    queryKey: ["machines", id],
    queryFn: () => fetch(`/api/machines/${id}`).then((r) => r.json()),
  });

  if (isLoading || !machine) {
    return <div className="py-20 text-center text-muted-foreground text-sm">Yükleniyor...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <Link
          href={`/makineler/${id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Makine Detay
        </Link>
        <h1 className="text-2xl font-semibold flex-1">Makine Etiketi</h1>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" />
          Yazdır
        </Button>
      </div>

      <div className="flex justify-center">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 w-[300px] print:border-solid print:border-black">
          <div className="text-center space-y-3">
            <h2 className="text-lg font-bold">MaintainPro</h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/machines/${id}/qr`}
              alt={`QR: ${machine.code}`}
              width={200}
              height={200}
              className="mx-auto"
            />
            <div className="space-y-1">
              <p className="font-mono text-sm font-bold">{machine.code}</p>
              <p className="text-sm font-medium">{machine.name}</p>
              {machine.department?.name && (
                <p className="text-xs text-muted-foreground print:text-gray-600">
                  {machine.department.name}
                </p>
              )}
              {machine.line && (
                <p className="text-xs text-muted-foreground print:text-gray-600">
                  Hat: {machine.line}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .flex.justify-center,
          .flex.justify-center * { visibility: visible; }
          .flex.justify-center { position: absolute; top: 0; left: 0; }
        }
      `}</style>
    </div>
  );
}
