import type { DomainEvent } from "./types";

export type EventHandler = (event: DomainEvent) => void;

export type Unsubscribe = () => void;

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(channel: string, handler: EventHandler): Unsubscribe;
}
