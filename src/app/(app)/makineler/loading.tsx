import { Skeleton } from "@/components/ui/skeleton";

// Matches: makineler/page.tsx — card grid with table inside a Card
export default function MakinelerLoading() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Filter bar (Card header) */}
      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 p-4 border-b sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        {/* Table skeleton */}
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/50">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24 hidden md:block" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16 hidden sm:block" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>

        {/* Data rows */}
        <div className="divide-y">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20 font-mono shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28 hidden md:block shrink-0" />
              <Skeleton className="h-6 w-20 rounded-full shrink-0" />
              <Skeleton className="h-6 w-20 rounded-full hidden sm:block shrink-0" />
              <div className="ml-auto flex gap-2 shrink-0">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
