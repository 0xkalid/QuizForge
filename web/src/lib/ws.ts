// WebSocket client with exponential-backoff reconnect (spec §7).
//
// Reconnect: 0.5s → 8s. On reconnect, the caller's `onReopen` hook fires so it
// can re-send `join`/`host_join`. We never lose the player's place; the server
// is authoritative and replays state on (re)join.

import type { ClientMessage, ServerMessage } from '@shared/types';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

interface GameSocketOptions {
  pin: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  onReopen: () => void;
}

const MIN_BACKOFF = 500;
const MAX_BACKOFF = 8000;

export class GameSocket {
  private ws: WebSocket | null = null;
  private opts: GameSocketOptions;
  private backoff = MIN_BACKOFF;
  private closedByUser = false;
  private reconnectTimer: number | null = null;
  private hasConnectedOnce = false;

  constructor(opts: GameSocketOptions) {
    this.opts = opts;
  }

  connect(): void {
    this.closedByUser = false;
    this.open();
  }

  private wsUrl(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws/game/${this.opts.pin}`;
  }

  private open(): void {
    this.opts.onStatus(this.hasConnectedOnce ? 'reconnecting' : 'connecting');
    const ws = new WebSocket(this.wsUrl());
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.backoff = MIN_BACKOFF;
      this.opts.onStatus('open');
      const wasReconnect = this.hasConnectedOnce;
      this.hasConnectedOnce = true;
      if (wasReconnect) this.opts.onReopen();
      else this.opts.onReopen();
    });

    ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage;
        this.opts.onMessage(msg);
      } catch {
        /* ignore malformed */
      }
    });

    ws.addEventListener('close', (ev) => {
      this.ws = null;
      if (this.closedByUser || ev.code === 1000) {
        this.opts.onStatus('closed');
        return;
      }
      this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // close handler will follow and schedule reconnect
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    });
  }

  private scheduleReconnect(): void {
    this.opts.onStatus('reconnecting');
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    this.reconnectTimer = window.setTimeout(() => this.open(), delay);
  }

  send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) window.clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try {
        this.ws.close(1000, 'client closed');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
  }
}
