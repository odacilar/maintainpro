"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { DomainEvent, DomainEventType } from "./types";

type InvalidationMap = Partial<Record<DomainEventType, readonly string[][]>>;

const DEFAULT_INVALIDATIONS: InvalidationMap = {
  "breakdown.created": [["breakdowns"], ["dashboard"]],
  "breakdown.status_changed": [["breakdowns"], ["dashboard"]],
  "breakdown.assigned": [["breakdowns"], ["dashboard"]],
  "machine.created": [["machines"]],
  "machine.updated": [["machines"]],
  "machine.status_changed": [["machines"], ["dashboard"]],
  "stock.movement": [["spare-parts"], ["dashboard"]],
  "stock.minimum_reached": [["spare-parts"], ["spare-parts-alerts"], ["dashboard"]],
  "checklist.completed": [["checklists"], ["checklist-records"], ["dashboard"]],
  "action.created": [["actions"], ["checklists"], ["dashboard"]],
  "action.status_changed": [["actions"], ["dashboard"]],
};

/**
 * Opens an SSE connection to /api/events/stream and invalidates TanStack Query
 * keys whenever a domain event for the current factory arrives. Mount once at
 * the app shell level.
 */
export function useRealtimeInvalidation(
  overrides?: InvalidationMap,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource("/api/events/stream");
    const map = { ...DEFAULT_INVALIDATIONS, ...overrides };

    const onMessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as DomainEvent;
        const keys = map[event.type];
        if (!keys) return;
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      } catch {
        // malformed event — ignore
      }
    };

    // One listener per known event type so servers can filter by name
    const types: DomainEventType[] = [
      "breakdown.created",
      "breakdown.status_changed",
      "breakdown.assigned",
      "machine.created",
      "machine.updated",
      "machine.status_changed",
      "stock.movement",
      "stock.minimum_reached",
      "checklist.completed",
      "action.created",
      "action.status_changed",
    ];
    for (const t of types) source.addEventListener(t, onMessage);

    source.onerror = () => {
      // Browser will auto-reconnect; log for dev
      if (process.env.NODE_ENV === "development") {
        console.warn("[realtime] SSE connection error, retrying…");
      }
    };

    return () => {
      for (const t of types) source.removeEventListener(t, onMessage);
      source.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
