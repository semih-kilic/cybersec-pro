/**
 * Connection Status Indicator
 * Shows API connectivity status in the header.
 * Uses SSE as primary transport (always works), WebSocket as optional enhancement.
 */
import { useState, useEffect } from 'react';

export function ConnectionStatus() {
  const [isLive, setIsLive] = useState(true);

  // Periodically check backend health (lightweight ping)
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch('/health', { signal: AbortSignal.timeout(5000) });
        if (mounted) setIsLive(res.ok);
      } catch {
        if (mounted) setIsLive(false);
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-gray-400"
      title={isLive ? 'Backend connected' : 'Backend unreachable'}
    >
      <span
        className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
      />
      <span className="hidden xl:inline">{isLive ? 'Live' : 'Offline'}</span>
    </div>
  );
}

export default ConnectionStatus;
