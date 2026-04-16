"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top-bar progress indicator for route transitions.
 * Listens to pathname + searchParams changes and briefly animates a blue bar.
 * No external dependencies — uses Tailwind + CSS transitions only.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track previous path to detect navigation
  const prevRef = useRef<string>("");

  useEffect(() => {
    const current = pathname + searchParams.toString();

    // On first render just record the path, don't animate
    if (prevRef.current === "") {
      prevRef.current = current;
      return;
    }

    if (prevRef.current === current) return;
    prevRef.current = current;

    // Start animation
    setWidth(0);
    setVisible(true);

    // Step 1: rapid fill to ~80%
    const t1 = setTimeout(() => setWidth(80), 20);

    // Step 2: complete to 100%
    const t2 = setTimeout(() => setWidth(100), 200);

    // Step 3: hide after transition
    const t3 = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 550);

    timerRef.current = t3;

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      role="progressbar"
      aria-label="Sayfa yükleniyor"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${width}%`,
          transition: width === 0 ? "none" : "width 300ms ease-in-out",
        }}
      />
    </div>
  );
}
