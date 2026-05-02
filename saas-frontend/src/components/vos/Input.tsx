import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/* ─── <Input> ──────────────────────────────────────────────────── */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, containerClassName, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className={cn('flex flex-col gap-vos-2', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-vos-xs font-medium text-vos-text-3 tracking-[0.02em]"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-vos-text-3 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : undefined}
          className={cn(
            'vos-input',
            leftIcon && 'pl-10',
            rightSlot && 'pr-10',
            error && 'border-vos-danger focus:border-vos-danger focus:shadow-[0_0_0_4px_var(--vos-danger-soft)]',
            className,
          )}
          {...rest}
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-vos-text-3">
            {rightSlot}
          </span>
        )}
      </div>
      {error ? (
        <span id={`${inputId}-err`} className="text-vos-xs text-vos-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-vos-xs text-vos-text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
});

/* ─── <Textarea> ───────────────────────────────────────────────── */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, rows = 4, ...rest },
  ref,
) {
  const tId = id ?? rest.name;
  return (
    <div className={cn('flex flex-col gap-vos-2', containerClassName)}>
      {label && (
        <label htmlFor={tId} className="text-vos-xs font-medium text-vos-text-3 tracking-[0.02em]">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={tId}
        rows={rows}
        aria-invalid={!!error || undefined}
        className={cn(
          'vos-input resize-y',
          error && 'border-vos-danger focus:border-vos-danger focus:shadow-[0_0_0_4px_var(--vos-danger-soft)]',
          className,
        )}
        {...rest}
      />
      {error ? (
        <span className="text-vos-xs text-vos-danger">{error}</span>
      ) : hint ? (
        <span className="text-vos-xs text-vos-text-muted">{hint}</span>
      ) : null}
    </div>
  );
});
