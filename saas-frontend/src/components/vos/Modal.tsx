import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/cn';

/**
 * Modal — centered glass dialog with scale-in transition.
 * For destructive confirmations, multi-step forms, etc.
 */
export function Modal({
  open,
  onClose,
  size = 'md',
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = '';
    };
  }, [open, onClose]);

  const sizeMap: Record<NonNullable<Parameters<typeof Modal>[0]['size']>, string> = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-vos-modal flex items-center justify-center p-vos-4">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative vos-glass-4 w-full',
              sizeMap[size],
              'rounded-vos-2xl flex flex-col max-h-[90vh] vos-scrollbar overflow-hidden',
              className,
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ModalHeader({
  title,
  description,
  onClose,
  className,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-vos-4 p-vos-6 border-b border-vos-border-1',
        className,
      )}
    >
      <div className="flex flex-col gap-vos-1 min-w-0">
        {(title || children) && <h2 className="vos-h3">{title ?? children}</h2>}
        {description && <p className="text-vos-sm text-vos-text-3">{description}</p>}
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

export function ModalBody({ className, children }: { className?: string; children?: ReactNode }) {
  return <div className={cn('p-vos-6 overflow-y-auto vos-scrollbar', className)}>{children}</div>;
}

export function ModalFooter({ className, children }: { className?: string; children?: ReactNode }) {
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
