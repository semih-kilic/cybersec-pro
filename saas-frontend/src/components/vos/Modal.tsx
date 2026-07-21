import { useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/cn';

/**
 * Modal — V21 Enhanced. Centered glass dialog with improved transitions.
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
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
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
    full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
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
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
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

/* ─── ConfirmModal — reusable confirmation dialog ──────────────── */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <ModalHeader title={title} onClose={onClose} />
      <ModalBody>
        {description && <p className="text-vos-sm text-vos-text-2">{description}</p>}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="vos-btn"
          disabled={loading}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn('vos-btn', danger ? 'vos-btn-danger' : 'vos-btn-primary')}
          disabled={loading}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
