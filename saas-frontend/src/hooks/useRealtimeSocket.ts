/**
 * useRealtimeSocket – React hook wrapping the WebSocket singleton.
 *
 * Provides:
 *  - connection state
 *  - subscribe/unsubscribe helpers
 *  - auto-connect on mount & auto-disconnect awareness
 *
 * Does NOT create a new socket per component – uses the shared wsManager.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { wsManager, ConnectionState } from '../lib/socketManager';

// Re-export for convenience
export type { ConnectionState };

/**
 * Lightweight hook – just the connection state + manager reference.
 * Connect once at the app root; consumers only add listeners.
 */
export function useRealtimeSocket() {
  const [state, setState] = useState<ConnectionState>(wsManager.connectionState);

  useEffect(() => {
    const unsub = wsManager.on('connectionChange', (s: unknown) => {
      setState(s as ConnectionState);
    });
    // Sync in case it changed between render and effect
    setState(wsManager.connectionState);
    return unsub;
  }, []);

  return {
    state,
    isConnected: state === 'connected',
    isReconnecting: state === 'reconnecting',
    connect: useCallback((token?: string) => wsManager.connect(token), []),
    disconnect: useCallback(() => wsManager.disconnect(), []),
    manager: wsManager,
  };
}

/**
 * Subscribe to scan updates for a specific scan ID.
 * Automatically joins/leaves scan room and buffers output lines.
 */
export function useScanRealtimeSubscription(scanId: string | null) {
  const [progress, setProgress] = useState<{
    scan_id: string;
    status: string;
    progress: number;
  } | null>(null);
  const [output, setOutput] = useState<{ scan_id: string; line: string }[]>([]);
  const [complete, setComplete] = useState<{
    scan_id: string;
    status: string;
    exit_code: number;
    output_preview?: string;
  } | null>(null);

  const outputRef = useRef(output);
  outputRef.current = output;

  useEffect(() => {
    if (!scanId) return;

    // Ensure connected
    if (!wsManager.isConnected) wsManager.connect();

    wsManager.subscribeScan(scanId);
    wsManager.requestStatus(scanId);

    const unsubs = [
      wsManager.on('scan_progress', (data: unknown) => {
        const d = data as { scan_id: string; status: string; progress: number };
        if (d.scan_id === scanId) setProgress(d);
      }),
      wsManager.on('scan_output', (data: unknown) => {
        const d = data as { scan_id: string; line: string };
        if (d.scan_id === scanId) {
          setOutput((prev) => [...prev.slice(-999), d]);
        }
      }),
      wsManager.on('scan_complete', (data: unknown) => {
        const d = data as { scan_id: string; status: string; exit_code: number; output_preview?: string };
        if (d.scan_id === scanId) setComplete(d);
      }),
      wsManager.on('scan_status', (data: unknown) => {
        const d = data as { scan_id: string; status: string; progress: number };
        if (d.scan_id === scanId) setProgress(d);
      }),
    ];

    return () => {
      wsManager.unsubscribeScan(scanId);
      unsubs.forEach((u) => u());
    };
  }, [scanId]);

  const clearOutput = useCallback(() => {
    setOutput([]);
    setProgress(null);
    setComplete(null);
  }, []);

  return { progress, output, complete, clearOutput, isConnected: wsManager.isConnected };
}

export default useRealtimeSocket;
