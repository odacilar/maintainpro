import { EventEmitter } from "node:events";
import type { EventBus, EventHandler, Unsubscribe } from "./bus";
import { channelFor, type DomainEvent } from "./types";

/**
 * Single-process in-memory bus. Suitable for MVP (one App Runner container)
 * and for tests. Swap for PostgresListenNotifyBus when horizontal scaling lands.
 */
export class InMemoryBus implements EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  async publish(event: DomainEvent): Promise<void> {
    const channel = channelFor(event.factoryId);
    this.emitter.emit(channel, event);
    this.emitter.emit("*", event);
  }

  subscribe(channel: string, handler: EventHandler): Unsubscribe {
    this.emitter.on(channel, handler);
    return () => this.emitter.off(channel, handler);
  }
}
