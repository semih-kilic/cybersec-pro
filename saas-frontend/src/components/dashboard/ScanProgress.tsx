/**
 * 🛡️ CyberSec Pro — Scan Progress Stepper (V12)
 *
 * Vertical stepper showing every scan lifecycle phase in real-time.
 * Subscribes to WebSocket `scan_phase_update` events.
 *
 * Phases:
 *   INITIALIZING → RESOLVING_TARGET → PREPARING_TOOL → EXECUTING
 *   → PARSING_OUTPUT → SAVING_RESULTS → COMPLETED / FAILED
 */

import React, { useEffect, useState, useRef } from 'react';
import { wsManager } from '../../lib/socketManager';

// ── Phase Definitions ──

export type ScanPhaseKey =
  | 'INITIALIZING'
  | 'RESOLVING_TARGET'
  | 'PREPARING_TOOL'
  | 'EXECUTING'
  | 'PARSING_OUTPUT'
  | 'SAVING_RESULTS'
  | 'COMPLETED'
  | 'FAILED';

interface PhaseDefinition {
  key: ScanPhaseKey;
  label: string;
  icon: string;
}

const PHASES: PhaseDefinition[] = [
  { key: 'INITIALIZING',     label: 'Initializing',      icon: '⚙️' },
  { key: 'RESOLVING_TARGET', label: 'Resolving Target',  icon: '🌐' },
  { key: 'PREPARING_TOOL',   label: 'Preparing Tool',    icon: '🔧' },
  { key: 'EXECUTING',        label: 'Executing Scan',    icon: '🚀' },
  { key: 'PARSING_OUTPUT',   label: 'Parsing Results',   icon: '📊' },
  { key: 'SAVING_RESULTS',   label: 'Saving Findings',   icon: '💾' },
  { key: 'COMPLETED',        label: 'Complete',           icon: '✅' },
];

interface PhaseState {
  phase: ScanPhaseKey;
  description: string;
  progress: number;
  timestamp: number;
}

// ── Component Props ──

interface ScanProgressProps {
  scanId: string | null;
  /** Whether the scan is currently active (show pulse animation) */
  isRunning?: boolean;
  /** Fallback status from page state when no phase events are available */
  status?: 'idle' | 'running' | 'completed' | 'failed';
  /** Fallback numeric progress from page state */
  progress?: number;
  /** Number of output lines emitted so far (used as execution signal) */
  outputCount?: number;
  /** Optional className for the outer container */
  className?: string;
}

const normalizePhase = (raw: unknown): ScanPhaseKey | null => {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  switch (key) {
    case 'INITIALIZING':
    case 'RESOLVING_TARGET':
    case 'PREPARING_TOOL':
    case 'EXECUTING':
    case 'PARSING_OUTPUT':
    case 'SAVING_RESULTS':
    case 'COMPLETED':
    case 'FAILED':
      return key;
    default:
      return null;
  }
};

const phaseFromProgress = (progress: number, outputCount: number): ScanPhaseKey => {
  if (progress >= 95) return 'SAVING_RESULTS';
  if (progress >= 85) return 'PARSING_OUTPUT';
  // If we already have streamed output, we are executing even if percentage stays low.
  if (outputCount > 0 || progress >= 25) return 'EXECUTING';
  if (progress >= 15) return 'PREPARING_TOOL';
  if (progress >= 5) return 'RESOLVING_TARGET';
  return 'INITIALIZING';
};

// ── Exported Component ──

export const ScanProgress: React.FC<ScanProgressProps> = ({
  scanId,
  isRunning: _isRunning = false,
  status,
  progress = 0,
  outputCount = 0,
  className = '',
}) => {
  const [currentPhase, setCurrentPhase] = useState<PhaseState | null>(null);
  const [completedPhases, setCompletedPhases] = useState<Set<ScanPhaseKey>>(new Set());
  const [phaseHistory, setPhaseHistory] = useState<PhaseState[]>([]);
  const [isFailed, setIsFailed] = useState(false);
  const prevPhaseRef = useRef<ScanPhaseKey | null>(null);

  // ── Reset on new scan ──
  useEffect(() => {
    setCurrentPhase(null);
    setCompletedPhases(new Set());
    setPhaseHistory([]);
    setIsFailed(false);
    prevPhaseRef.current = null;
  }, [scanId]);

  // ── Subscribe to phase updates via wsManager ──
  useEffect(() => {
    if (!scanId) return;

    const handlePhaseUpdate = (data: any) => {
      if (data?.scan_id !== scanId) return;

      const phase = normalizePhase(data.phase);
      if (!phase) return;
      const description = data.description || '';
      const progress = data.progress || 0;

      const newState: PhaseState = {
        phase,
        description,
        progress,
        timestamp: Date.now(),
      };

      // Mark previously current phase as completed
      if (prevPhaseRef.current && prevPhaseRef.current !== phase) {
        setCompletedPhases(prev => {
          const next = new Set(prev);
          next.add(prevPhaseRef.current!);
          return next;
        });
      }

      // Mark all phases before the current one as completed
      const currentIndex = PHASES.findIndex(p => p.key === phase);
      if (currentIndex > 0) {
        setCompletedPhases(prev => {
          const next = new Set(prev);
          for (let i = 0; i < currentIndex; i++) {
            next.add(PHASES[i].key);
          }
          return next;
        });
      }

      if (phase === 'FAILED') {
        setIsFailed(true);
      }

      if (phase === 'COMPLETED') {
        // Mark all phases as completed
        setCompletedPhases(new Set(PHASES.map(p => p.key)));
      }

      setCurrentPhase(newState);
      setPhaseHistory(prev => [...prev, newState]);
      prevPhaseRef.current = phase;
    };

    // Some backend paths publish phase info inside scan_output events instead of
    // dedicated scan_phase_update events. Listen to both for compatibility.
    const unsubPhase = wsManager.on('scan_phase_update', handlePhaseUpdate);
    const unsubOutput = wsManager.on('scan_output', handlePhaseUpdate);
    return () => {
      unsubPhase();
      unsubOutput();
    };
  }, [scanId]);

  // Fallback progression when no explicit phase events are published.
  useEffect(() => {
    if (!scanId || phaseHistory.length > 0) return;

    if (status === 'completed') {
      setIsFailed(false);
      setCompletedPhases(new Set(PHASES.map(p => p.key)));
      setCurrentPhase({
        phase: 'COMPLETED',
        description: 'Scan completed successfully',
        progress: 100,
        timestamp: Date.now(),
      });
      return;
    }

    if (status === 'failed') {
      const inferred = phaseFromProgress(progress, outputCount);
      const idx = PHASES.findIndex(p => p.key === inferred);
      setIsFailed(true);
      setCompletedPhases(new Set(PHASES.slice(0, Math.max(idx, 0)).map(p => p.key)));
      setCurrentPhase({
        phase: inferred,
        description: 'Scan failed during execution',
        progress: Math.max(1, Math.min(100, progress || 1)),
        timestamp: Date.now(),
      });
      return;
    }

    if (status === 'running') {
      const inferred = phaseFromProgress(progress, outputCount);
      const idx = PHASES.findIndex(p => p.key === inferred);
      setIsFailed(false);
      setCompletedPhases(new Set(PHASES.slice(0, Math.max(idx, 0)).map(p => p.key)));
      setCurrentPhase({
        phase: inferred,
        description: outputCount > 0 ? 'Tool output streaming' : 'Preparing scan pipeline',
        progress: Math.max(1, Math.min(99, progress || (outputCount > 0 ? 40 : 5))),
        timestamp: Date.now(),
      });
    }
  }, [scanId, status, progress, outputCount, phaseHistory.length]);

  // ── Derive display state for each phase ──
  const getPhaseStatus = (phaseKey: ScanPhaseKey): 'completed' | 'active' | 'pending' | 'failed' => {
    if (isFailed && currentPhase?.phase === phaseKey) return 'failed';
    if (completedPhases.has(phaseKey)) return 'completed';
    if (currentPhase?.phase === phaseKey) return 'active';
    return 'pending';
  };

  // If no scan or no phases received yet, show minimal skeleton
  if (!scanId) return null;

  const progressPercent = currentPhase?.progress || 0;

  return (
    <div className={`scan-progress-stepper ${className}`}>
      {/* ── Progress Bar ── */}
      <div className="progress-bar-container">
        <div className="progress-bar-bg">
          <div
            className={`progress-bar-fill ${isFailed ? 'failed' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="progress-text">{progressPercent}%</span>
      </div>

      {/* ── Vertical Stepper ── */}
      <div className="stepper-container">
        {PHASES.filter(p => p.key !== 'COMPLETED' || completedPhases.has('COMPLETED')).map((phase, idx) => {
          const status = getPhaseStatus(phase.key);
          const historyEntry = phaseHistory.find(h => h.phase === phase.key);

          return (
            <div key={phase.key} className={`step step-${status}`}>
              {/* Connector line */}
              {idx > 0 && (
                <div className={`step-connector ${
                  status === 'completed' || status === 'active' ? 'active' : ''
                }`} />
              )}

              {/* Step indicator */}
              <div className={`step-indicator ${status}`}>
                {status === 'completed' && (
                  <svg className="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {status === 'active' && <div className="pulse-dot" />}
                {status === 'failed' && (
                  <svg className="fail-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
                {status === 'pending' && <span className="step-number">{idx + 1}</span>}
              </div>

              {/* Step content */}
              <div className="step-content">
                <div className="step-label">
                  <span className="step-icon">{phase.icon}</span>
                  <span className="step-title">{phase.label}</span>
                </div>
                {(status === 'active' || status === 'completed' || status === 'failed') && historyEntry && (
                  <div className="step-description">{historyEntry.description}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Inline styles (Tailwind-compatible, dark theme) ── */}
      <style>{`
        .scan-progress-stepper {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(34, 197, 94, 0.15);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 12px;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
        }

        /* ── Progress Bar ── */
        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .progress-bar-bg {
          flex: 1;
          height: 6px;
          background: rgba(100, 116, 139, 0.3);
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #10b981);
          border-radius: 3px;
          transition: width 0.5s ease;
        }
        .progress-bar-fill.failed {
          background: linear-gradient(90deg, #ef4444, #dc2626);
        }
        .progress-text {
          font-size: 12px;
          color: #22c55e;
          font-weight: 600;
          min-width: 36px;
          text-align: right;
        }

        /* ── Stepper ── */
        .stepper-container {
          display: flex;
          flex-direction: column;
          gap: 0;
          position: relative;
        }

        .step {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          position: relative;
          padding: 6px 0;
          min-height: 36px;
        }

        /* Connector line */
        .step-connector {
          position: absolute;
          left: 13px;
          top: -6px;
          width: 2px;
          height: 12px;
          background: rgba(100, 116, 139, 0.3);
        }
        .step-connector.active {
          background: #22c55e;
        }

        /* Indicator */
        .step-indicator {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.3s ease;
          position: relative;
          z-index: 1;
        }
        .step-indicator.completed {
          background: rgba(34, 197, 94, 0.2);
          border: 2px solid #22c55e;
          color: #22c55e;
        }
        .step-indicator.active {
          background: rgba(59, 130, 246, 0.2);
          border: 2px solid #3b82f6;
          color: #3b82f6;
        }
        .step-indicator.pending {
          background: rgba(100, 116, 139, 0.1);
          border: 2px solid rgba(100, 116, 139, 0.3);
          color: rgba(100, 116, 139, 0.5);
        }
        .step-indicator.failed {
          background: rgba(239, 68, 68, 0.2);
          border: 2px solid #ef4444;
          color: #ef4444;
        }

        .check-icon, .fail-icon {
          width: 14px;
          height: 14px;
        }

        .step-number {
          font-size: 11px;
          font-weight: 600;
        }

        /* Pulse animation for active step */
        .pulse-dot {
          width: 10px;
          height: 10px;
          background: #3b82f6;
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
        }

        /* Content */
        .step-content {
          flex: 1;
          min-width: 0;
          padding-top: 3px;
        }
        .step-label {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .step-icon {
          font-size: 14px;
          line-height: 1;
        }
        .step-title {
          font-size: 13px;
          font-weight: 500;
          color: #e2e8f0;
        }
        .step-completed .step-title {
          color: #22c55e;
        }
        .step-active .step-title {
          color: #3b82f6;
        }
        .step-pending .step-title {
          color: rgba(148, 163, 184, 0.6);
        }
        .step-failed .step-title {
          color: #ef4444;
        }
        .step-description {
          font-size: 11px;
          color: rgba(148, 163, 184, 0.7);
          margin-top: 2px;
          margin-left: 20px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
};

export default ScanProgress;
