import { Skeleton } from "@/components/ui/skeleton";

// Matches: parcalar/page.tsx — alert banner + table with code, name, kategori, birim, stok, min stok, fiyat columns
export default function ParcalarLoading() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Stock alerts placeholder */}
      <Skeleton className="h-14 w-full rounded-lg" />

      {/* Filter bar + table */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 p-4 border-b sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1" />
          <div className="flex gap-2 flex-wrap items-center">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/50">
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-3 w-20 hidden md:block shrink-0" />
          <Skeleton className="h-3 w-12 hidden sm:block shrink-0" />
          <Skeleton className="h-3 w-12 shrink-0" />
          <Skeleton className="h-3 w-16 hidden sm:block shrink-0" />
          <Skeleton className="h-3 w-16 hidden lg:block shrink-0" />
          <Skeleton className="h-3 w-16 ml-auto shrink-0" />
        </div>

        {/* Data rows */}
        <div className="divide-y">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              {/* Parça Kodu */}
              <Skeleton className="h-4 w-20 shrink-0" />
              {/* Parça Adı + konum */}
              <div className="shrink-0 space-y-1 w-40">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              {/* Kategori */}
              <Skeleton className="h-4 w-20 hidden md:block shrink-0" />
              {/* Birim */}
              <Skeleton className="h-4 w-12 hidden sm:block shrink-0" />
              {/* Stok + badge */}
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              {/* Min stok */}
              <Skeleton className="h-4 w-8 hidden sm:block shrink-0" />
              {/* Fiyat */}
              <Skeleton className="h-4 w-16 hidden lg:block shrink-0" />
              {/* Actions */}
              <Skeleton className="h-8 w-14 ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
