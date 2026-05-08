// Fake socket.io-client `io()` factory. Upstream's connection-manager looks
// for `window.io` (a script tag injects the real one in production). For
// our offline build we register a stub that immediately reports as
// connected, swallows emits, and never fires any incoming events. The IDE
// UI mounts as if a real-time backend were present and idle.

type Listener = (...args: unknown[]) => void;

class FakeSocket {
  // Mimic the engine.io socket object connection-manager pokes at
  socket = {
    transport: { name: 'websocket' as const },
    transports: ['websocket', 'polling'],
    connected: true,
    open() { /* no-op */ },
    close() { /* no-op */ },
    reconnect: () => {},
    on: this._on.bind(this),
    once: this._once.bind(this),
    off: this._off.bind(this),
  };

  connected = true;
  disconnected = false;
  id = 'fake-socket';

  private listeners = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    // Synthesize an immediate `connect` so the connection-context resolves.
    if (event === 'connect') queueMicrotask(() => fn());
    return this;
  }
  once(event: string, fn: Listener): this {
    const wrap: Listener = (...a) => { this.off(event, wrap); fn(...a); };
    return this.on(event, wrap);
  }
  off(event: string, fn?: Listener): this {
    if (!fn) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(fn);
    return this;
  }
  emit(_event: string, ..._args: unknown[]): this { return this; }
  send(..._args: unknown[]): this { return this; }
  connect(): this { return this; }
  disconnect(): this { this.connected = false; this.disconnected = true; return this; }
  removeAllListeners(): this { this.listeners.clear(); return this; }
  hasListeners(event: string): boolean { return (this.listeners.get(event)?.size ?? 0) > 0; }

  private _on(event: string, fn: Listener) { return this.on(event, fn); }
  private _once(event: string, fn: Listener) { return this.once(event, fn); }
  private _off(event: string, fn?: Listener) { return this.off(event, fn); }
}

export default function fakeIo(_url?: string, _opts?: unknown): FakeSocket {
  return new FakeSocket();
}
