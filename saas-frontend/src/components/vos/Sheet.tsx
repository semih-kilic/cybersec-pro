import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/cn';

/**
 * Sheet — side-anchored panel (right or left). Glass surface,
 * spring-eased slide-in. Use for detail views, filters, settings.
 */
export function Sheet({
  open,
  onClose,
  side = 'right',
  width = 480,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  width?: number;
  children?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-vos-overlay bg-black/40 backdrop-blur-sm"
            aria-hidden
          />
          <motion.aside
            key="sheet"
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: `min(100vw, ${width}px)` }}
            className={cn(
              'fixed top-0 bottom-0 z-vos-modal vos-glass-4 flex flex-col vos-scrollbar',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              'border-vos-border-2',
              className,
            )}
            role="dialog"
            aria-modal="true"
          >
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function SheetHeader({
  title,
  description,
  onClose,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-vos-4 p-vos-6 border-b border-vos-border-1',
        className,
      )}
    >
      <div className="flex flex-col gap-vos-1 min-w-0">
        {title && <h2 className="vos-h3">{title}</h2>}
        {description && (
          <p className="text-vos-sm text-vos-text-3">{description}</p>
        )}
        {children}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="vos-btn vos-btn-ghost vos-btn-icon shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </header>
  );
}

export function SheetBody({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('flex-1 overflow-y-auto p-vos-6 vos-scrollbar', className)}>{children}</div>;
}

export function SheetFooter({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <footer
      className={cn(
        'flex items-center justify-end gap-vos-3 p-vos-6 border-t border-vos-border-1',
        className,
      )}
    >
      {children}
    </footer>
  );
}
