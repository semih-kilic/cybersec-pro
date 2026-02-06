/**
 * 🛡️ CyberSec Pro - WebSocket Hook
 * Real-time scan updates via Socket.IO
 * 
 * Author: Semih Kılıç
 * Version: 1.0.0 (FAZ 2)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// WebSocket server URL - uses same origin by default
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WS_URL = (typeof window !== 'undefined' && (window as any).__WS_URL__) || '';

interface ScanProgress {
  scan_id: string;
  status: string;
  progress: number;
  started_at?: string;
}

interface ScanOutput {
  scan_id: string;
  line: string;
}

interface ScanComplete {
  scan_id: string;
  status: string;
  output_preview?: string;
  output_length?: number;
  exit_code: number;
}

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface UseWebSocketReturn {
  // Connection state
  connected: boolean;
  connecting: boolean;
  error: string | null;
  
  // Methods
  connect: () => void;
  disconnect: () => void;
  
  // Scan subscription
  subscribeScan: (scanId: string) => void;
  unsubscribeScan: (scanId: string) => void;
  subscribeUser: (userId: string) => void;
  
  // Event data
  scanProgress: ScanProgress | null;
  scanOutput: ScanOutput[];
  scanComplete: ScanComplete | null;
  
  // Manual refresh
  requestStatus: (scanId: string) => void;
  
  // Clear state
  clearOutput: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options;
  
  const socketRef = useRef<Socket | null>(null);
  
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanOutput, setScanOutput] = useState<ScanOutput[]>([]);
  const [scanComplete, setScanComplete] = useState<ScanComplete | null>(null);
  
  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    setConnecting(true);
    setError(null);
    
    const socket = io(WS_URL + '/scans', {
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling'],
      withCredentials: true
    });
    
    // Connection events
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected:', socket.id);
      setConnected(true);
      setConnecting(false);
      setError(null);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, won't auto-reconnect
        setError('Server disconnected');
      }
    });
    
    socket.on('connect_error', (err) => {
      console.error('🔌 WebSocket error:', err.message);
      setConnecting(false);
      setError(err.message);
    });
    
    // Scan events
    socket.on('scan_progress', (data: ScanProgress) => {
      console.log('📊 Scan progress:', data);
      setScanProgress(data);
    });
    
    socket.on('scan_output', (data: ScanOutput) => {
      setScanOutput(prev => [...prev.slice(-500), data]); // Keep last 500 lines
    });
    
    socket.on('scan_complete', (data: ScanComplete) => {
      console.log('✅ Scan complete:', data);
      setScanComplete(data);
    });
    
    socket.on('scan_status', (data: ScanProgress) => {
      setScanProgress(data);
    });
    
    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });
    
    socketRef.current = socket;
  }, [reconnection, reconnectionAttempts, reconnectionDelay]);
  
  // Disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);
  
  // Subscribe to specific scan updates
  const subscribeScan = useCallback((scanId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join_scan', { scan_id: scanId });
    }
  }, []);
  
  // Unsubscribe from scan updates
  const unsubscribeScan = useCallback((scanId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave_scan', { scan_id: scanId });
    }
  }, []);
  
  // Subscribe to user's scans
  const subscribeUser = useCallback((userId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_user', { user_id: userId });
    }
  }, []);
  
  // Request current status
  const requestStatus = useCallback((scanId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('request_status', { scan_id: scanId });
    }
  }, []);
  
  // Clear output buffer
  const clearOutput = useCallback(() => {
    setScanOutput([]);
    setScanProgress(null);
    setScanComplete(null);
  }, []);
  
  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);
  
  return {
    connected,
    connecting,
    error,
    connect,
    disconnect,
    subscribeScan,
    unsubscribeScan,
    subscribeUser,
    scanProgress,
    scanOutput,
    scanComplete,
    requestStatus,
    clearOutput
  };
}

// Simpler hook for single scan subscription
export function useScanSubscription(scanId: string | null) {
  const ws = useWebSocket({ autoConnect: !!scanId });
  
  useEffect(() => {
    if (scanId && ws.connected) {
      ws.subscribeScan(scanId);
      ws.requestStatus(scanId);
      
      return () => {
        ws.unsubscribeScan(scanId);
      };
    }
  }, [scanId, ws.connected]);
  
  return {
    connected: ws.connected,
    progress: ws.scanProgress,
    output: ws.scanOutput,
    complete: ws.scanComplete,
    error: ws.error
  };
}

export default useWebSocket;
