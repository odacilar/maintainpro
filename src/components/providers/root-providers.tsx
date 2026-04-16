"use client";

import { Suspense } from "react";
import { SessionProvider } from "./session-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";
import { RouteProgress } from "@/components/ui/route-progress";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <QueryProvider>
          {/* RouteProgress uses useSearchParams — must be wrapped in Suspense per Next.js 14 */}
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          {children}
        </QueryProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
