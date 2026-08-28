/**
 * WebSocket Manager - Singleton
 * Handles reconnection, heartbeat, binary protocol, and event distribution.
 *
 * Usage:
 *   import { wsManager } from './socketManager';
 *   wsManager.connect(token);
 *   wsManager.on('scan_complete', handler);
 */
import { io, Socket } from 'socket.io-client';

// --- Types ---
export type WSEvent =
  | 'scan_progress'
  | 'scan_output'
  | 'scan_complete'
  | 'scan_status'
  | 'scan_phase_update'
  | 'notification'
  | 'activity'
  | 'agent_status'
  | 'heartbeat'
  | 'engine_stats'
  | 'connected'
  | 'error';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface WSManagerEvents {
  /** Fired when connection state changes */
  connectionChange: (state: ConnectionState) => void;
  /** Fired on any recognized event */
  [event: string]: (...args: any[]) => void;
}

// --- Config ---
const HEARTBEAT_INTERVAL = 30_000; // 30s
const RECONNECT_BASE_DELAY = 1_000; // 1s
const RECONNECT_MAX_DELAY = 30_000; // 30s cap
const RECONNECT_MAX_ATTEMPTS = 3; // stop after 3 failed attempts — SSE is the primary transport
const OUTPUT_BUFFER_LIMIT = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WS_URL = (typeof window !== 'undefined' && (window as any).__WS_URL__) || '';

class WebSocketManager {
  private socket: Socket | null = null;
  private state: ConnectionState = 'disconnected';
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private subscribedScans = new Set<string>();
  private subscribedUser: string | null = null;

  // ---- Public API ----

  get connectionState(): ConnectionState {
    return this.state;
  }

  get isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Connect to the WebSocket server (idempotent).
   */
  connect(token?: string): void {
    if (this.socket?.connected) return;

    this.setState('connecting');

    const socket = io(WS_URL + '/scans', {
      reconnection: false, // we handle reconnection ourselves
      transports: ['websocket'], // prefer binary-capable websocket
      withCredentials: true,
      auth: token ? { token } : undefined,
      forceNew: false,
    });

    // Enable binary frames when supported
    try { (socket as any).io.engine && ((socket as any).io.engine.binaryType = 'arraybuffer'); } catch (_) { /* noop */ }

    // --- Connection lifecycle ---
    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      this.reconnectAttempt = 0;
      this.setState('connected');
      this.startHeartbeat();
      this.resubscribe();
    });

    socket.on('disconnect', (reason) => {
      console.warn('[WS] Disconnected:', reason);
      this.stopHeartbeat();

      if (reason === 'io server disconnect') {
        // Server kicked us – wait then retry
        this.setState('reconnecting');
        this.scheduleReconnect();
      } else {
        // Transport close / ping timeout → auto-retry
        this.setState('reconnecting');
        this.scheduleReconnect();
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[WS] Connect error:', err.message);
      this.setState('reconnecting');
      this.scheduleReconnect();
    });

    // --- Data events → fan-out to listeners ---
    const events: WSEvent[] = [
      'scan_progress',
      'scan_output',
      'scan_complete',
      'scan_status',
      'scan_phase_update',
      'notification',
      'activity',
      'agent_status',
      'heartbeat',
      'engine_stats',
      'connected',
      'error',
    ];

    for (const evt of events) {
      socket.on(evt, (...args: unknown[]) => {
        this.emit(evt, ...args);
      });
    }

    // Pong from server heartbeat
    socket.on('pong', (data: unknown) => {
      this.emit('heartbeat', data);
    });

    this.socket = socket;
  }

  /**
   * Disconnect and stop all timers.
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState('disconnected');
  }

  // ---- Subscriptions ----

  subscribeScan(scanId: string): void {
    this.subscribedScans.add(scanId);
    if (this.socket?.connected) {
      this.socket.emit('join_scan', { scan_id: scanId });
    }
  }

  unsubscribeScan(scanId: string): void {
    this.subscribedScans.delete(scanId);
    if (this.socket?.connected) {
      this.socket.emit('leave_scan', { scan_id: scanId });
    }
  }

  subscribeUser(userId: string): void {
    this.subscribedUser = userId;
    if (this.socket?.connected) {
      this.socket.emit('subscribe_user', { user_id: userId });
    }
  }

  requestStatus(scanId: string): void {
    this.socket?.emit('request_status', { scan_id: scanId });
  }

  /** Send a generic event to the server */
  send(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  // ---- Event Emitter ----

  on(event: string, fn: (...args: unknown[]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    // Return unsubscribe function
    return () => { this.listeners.get(event)?.delete(fn); };
  }

  off(event: string, fn: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(fn);
  }

  // ---- Private helpers ----

  private emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((fn) => {
      try { fn(...args); } catch (e) { console.error(`[WS] Listener error on ${event}:`, e); }
    });
  }

  private setState(s: ConnectionState): void {
    if (this.state === s) return;
    this.state = s;
    this.emit('connectionChange', s);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Exponential backoff reconnect with jitter.
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
      this.setState('disconnected');
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempt) + Math.random() * 500,
      RECONNECT_MAX_DELAY
    );
    this.reconnectAttempt++;
    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempt})`);

    setTimeout(() => {
      if (this.state === 'reconnecting') {
        // Kill old socket and create new one
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }
        this.connect();
      }
    }, delay);
  }

  /**
   * Re-subscribe to all rooms after reconnect.
   */
  private resubscribe(): void {
    for (const scanId of this.subscribedScans) {
      this.socket?.emit('join_scan', { scan_id: scanId });
    }
    if (this.subscribedUser) {
      this.socket?.emit('subscribe_user', { user_id: this.subscribedUser });
    }
  }
}

// Singleton
export const wsManager = new WebSocketManager();

export { OUTPUT_BUFFER_LIMIT };
export default wsManager;
