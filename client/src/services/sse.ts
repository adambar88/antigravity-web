/**
 * SSE Client for Antigravity Web session streaming
 */

import { SSEEventEnvelope, SSEEventType } from '@/types';

export type SSEConnectionStatus = 'connected' | 'streaming' | 'disconnected';

export interface SSEClientOptions {
  sessionId: string;
  onEvent: (envelope: SSEEventEnvelope) => void;
  onStatusChange: (status: SSEConnectionStatus) => void;
  onError?: (err: Event) => void;
}

const ALL_SSE_EVENTS: SSEEventType[] = [
  'session_status',
  'thought_delta',
  'thought_complete',
  'message_delta',
  'message_complete',
  'tool_start',
  'tool_progress',
  'tool_complete',
  'diff_created',
  'slash_command_result',
  'turn_error',
  'heartbeat',
];

export class SessionSSEClient {
  private eventSource: EventSource | null = null;
  private sessionId: string;
  private onEvent: (envelope: SSEEventEnvelope) => void;
  private onStatusChange: (status: SSEConnectionStatus) => void;
  private onError?: (err: Event) => void;
  private isDisposed = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(options: SSEClientOptions) {
    this.sessionId = options.sessionId;
    this.onEvent = options.onEvent;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;
    this.connect();
  }

  public connect(): void {
    if (this.isDisposed) return;
    this.cleanup();

    try {
      const base = import.meta.env.BASE_URL || '/';
      const apiBase = (base.endsWith('/') ? base : `${base}/`) + 'api';
      const url = `${apiBase}/sessions/${this.sessionId}/stream`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        if (this.isDisposed) return;
        this.reconnectAttempts = 0;
        this.onStatusChange('connected');
      };

      // General message listener for standard envelope payloads
      this.eventSource.onmessage = (event: MessageEvent) => {
        if (this.isDisposed) return;
        try {
          const envelope = JSON.parse(event.data) as SSEEventEnvelope;
          if (envelope && envelope.type) {
            this.handleEnvelope(envelope);
          }
        } catch {
          // Non-JSON or raw text
        }
      };

      // Also listen to named events for compatibility
      for (const eventName of ALL_SSE_EVENTS) {
        this.eventSource.addEventListener(eventName, ((event: MessageEvent) => {
          if (this.isDisposed) return;
          try {
            const raw = JSON.parse(event.data);
            // If already wrapped in envelope
            if (raw && raw.type && raw.payload !== undefined) {
              this.handleEnvelope(raw as SSEEventEnvelope);
            } else {
              // Construct envelope
              const envelope: SSEEventEnvelope = {
                seq: Date.now(),
                session_id: this.sessionId,
                timestamp: Date.now(),
                type: eventName,
                payload: raw,
              };
              this.handleEnvelope(envelope);
            }
          } catch {
            // ignore
          }
        }) as EventListener);
      }

      this.eventSource.onerror = (err) => {
        if (this.isDisposed) return;
        this.onStatusChange('disconnected');
        this.onError?.(err);

        // Auto reconnect with exponential backoff if not closed
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
          this.reconnectAttempts++;
          this.reconnectTimer = window.setTimeout(() => {
            this.connect();
          }, delay);
        }
      };
    } catch (e) {
      console.warn('Nie udało się nawiązać połączenia strumieniowego:', e);
      this.onStatusChange('disconnected');
    }
  }

  private handleEnvelope(envelope: SSEEventEnvelope): void {
    if (envelope.type === 'session_status') {
      const payload = envelope.payload as { status?: string };
      if (payload?.status === 'running') {
        this.onStatusChange('streaming');
      } else {
        this.onStatusChange('connected');
      }
    } else if (
      envelope.type === 'thought_delta' ||
      envelope.type === 'message_delta' ||
      envelope.type === 'tool_start' ||
      envelope.type === 'tool_progress'
    ) {
      this.onStatusChange('streaming');
    } else if (
      envelope.type === 'message_complete' ||
      envelope.type === 'turn_error'
    ) {
      this.onStatusChange('connected');
    }

    this.onEvent(envelope);
  }

  public disconnect(): void {
    this.isDisposed = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
