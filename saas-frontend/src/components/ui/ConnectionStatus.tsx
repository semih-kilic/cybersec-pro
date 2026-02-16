/**
 * WebSocket Connection Status Indicator
 * Shows real-time connection state in the header
 */
import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';

export function ConnectionStatus() {
  const { state, isConnected, connect } = useRealtimeSocket();

  const statusConfig = {
    connected: { color: 'bg-green-500', label: 'Live', pulse: true },
    connecting: { color: 'bg-yellow-500', label: 'Connecting', pulse: true },
    reconnecting: { color: 'bg-yellow-500', label: 'Reconnecting', pulse: true },
    disconnected: { color: 'bg-red-500', label: 'Offline', pulse: false },
  };

  const config = statusConfig[state];

  return (
    <button
      onClick={() => !isConnected && connect()}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition"
      title={`WebSocket: ${config.label}${!isConnected ? ' – Click to reconnect' : ''}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
      />
      <span className="hidden xl:inline">{config.label}</span>
    </button>
  );
}

export default ConnectionStatus;
