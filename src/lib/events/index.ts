import type { EventBus } from "./bus";
import { InMemoryBus } from "./in-memory";

declare global {
  // eslint-disable-next-line no-var
  var __eventBus: EventBus | undefined;
}

function create(): EventBus {
  // Future: pick PostgresBus when process.env.EVENT_BUS === "postgres"
  return new InMemoryBus();
}

export const events: EventBus = global.__eventBus ?? create();

if (process.env.NODE_ENV !== "production") {
  global.__eventBus = events;
}

export { channelFor } from "./types";
export type { DomainEvent, DomainEventType } from "./types";
