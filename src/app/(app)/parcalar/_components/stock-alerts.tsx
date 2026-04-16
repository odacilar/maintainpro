"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { stockStatusLabel, stockStatusVariant, unitLabel } from "@/lib/spare-part-helpers";
import type { SparePartListItem } from "@/types/spare-part";

export function StockAlerts() {
  const [open, setOpen] = useState(true);

  const { data: alerts } = useQuery<SparePartListItem[]>({
    queryKey: ["spare-parts", "alerts"],
    queryFn: () => fetch("/api/spare-parts/alerts").then((r) => r.json()),
  });

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">
          Stok Uyarıları — {alerts.length} parça minimum stok altında
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {alerts.map((part) => (
            <Link
              key={part.id}
              href={`/parcalar/${part.id}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-100/60 transition-colors"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-amber-900 truncate block">
                  {part.name}
                </span>
                <span className="text-xs text-amber-700 font-mono">{part.code}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-700">
                  {part.currentStock} / {part.minimumStock} {unitLabel(part.unit)}
                </span>
                <Badge variant={stockStatusVariant(part.currentStock, part.minimumStock)}>
                  {stockStatusLabel(part.currentStock, part.minimumStock)}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
