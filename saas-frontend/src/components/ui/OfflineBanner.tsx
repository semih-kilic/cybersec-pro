/**
 * OfflineBanner — V18 Phase 3
 * Global persistent banner that appears when browser goes offline.
 * Uses useOnlineStatus hook for detection.
 * Animated entrance/exit with framer-motion.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useOnlineStatus } from '../../hooks/useUtilities';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="bg-gradient-to-r from-red-900/90 via-red-800/90 to-red-900/90 backdrop-blur-sm border-b border-red-700/50">
            <div className="flex items-center justify-center gap-3 px-4 py-2.5 text-sm">
              {/* Pulsing offline icon */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>

              <span className="text-red-100 font-medium">
                You are offline
              </span>
              <span className="text-red-300/80 hidden sm:inline">
                — Check your internet connection. Changes will sync when restored.
              </span>

              {/* Retry button */}
              <button
                onClick={() => window.location.reload()}
                className="ml-2 px-3 py-1 rounded-md text-xs font-semibold bg-red-700/50 hover:bg-red-600/50 text-red-100 border border-red-600/40 transition-colors duration-150"
              >
                Retry
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default OfflineBanner;
