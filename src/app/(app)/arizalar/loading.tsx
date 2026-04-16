import { Skeleton } from "@/components/ui/skeleton";

// Matches: arizalar/page.tsx — table with code, machine, tip, öncelik, durum, bildiren, tarih columns
export default function ArizalarLoading() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Filter bar */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 p-4 border-b sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/50">
          <Skeleton className="h-3 w-20 shrink-0" />
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-3 w-16 hidden md:block shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-16 shrink-0" />
          <Skeleton className="h-3 w-20 hidden lg:block shrink-0" />
          <Skeleton className="h-3 w-24 hidden sm:block shrink-0" />
          <Skeleton className="h-3 w-16 ml-auto shrink-0" />
        </div>

        {/* Data rows */}
        <div className="divide-y">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              {/* Arıza No */}
              <Skeleton className="h-4 w-28 shrink-0 font-mono" />
              {/* Makine */}
              <div className="shrink-0 space-y-1 w-32">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              {/* Tip */}
              <Skeleton className="h-4 w-20 hidden md:block shrink-0" />
              {/* Öncelik badge */}
              <Skeleton className="h-6 w-16 rounded-full shrink-0" />
              {/* Durum badge */}
              <Skeleton className="h-6 w-24 rounded-full shrink-0" />
              {/* Bildiren */}
              <Skeleton className="h-4 w-24 hidden lg:block shrink-0" />
              {/* Tarih */}
              <Skeleton className="h-4 w-28 hidden sm:block shrink-0" />
              {/* Actions */}
              <Skeleton className="h-8 w-14 ml-auto shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
