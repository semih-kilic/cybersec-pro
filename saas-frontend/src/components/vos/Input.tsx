import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

/* ─── <Input> ──────────────────────────────────────────────────── */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
  showCount?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, success, leftIcon, rightSlot, className, containerClassName, id, showCount, maxLength, ...rest },
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
          maxLength={maxLength}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${inputId}-err` : hint ? `${inputId}-hint` : success ? `${inputId}-success` : undefined}
          className={cn(
            'vos-input',
            leftIcon && 'pl-10',
            rightSlot && 'pr-10',
            error && 'vos-input-error',
            success && !error && 'vos-input-success',
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
        <span id={`${inputId}-err`} className="text-vos-xs text-vos-danger flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M6 3.5v3M6 8h.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {error}
        </span>
      ) : success ? (
        <span id={`${inputId}-success`} className="text-vos-xs text-vos-success flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M4 6l1.5 1.5L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {success}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="text-vos-xs text-vos-text-muted">
          {hint}
        </span>
      ) : null}
      {showCount && maxLength && (
        <span className="text-vos-2xs text-vos-text-muted text-right">
          {rest.value?.toString().length || 0}/{maxLength}
        </span>
      )}
    </div>
  );
});

/* ─── <Textarea> ───────────────────────────────────────────────── */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  containerClassName?: string;
  showCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, success, className, containerClassName, id, rows = 4, showCount, maxLength, ...rest },
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
        maxLength={maxLength}
        aria-invalid={!!error || undefined}
        className={cn(
          'vos-input resize-y',
          error && 'vos-input-error',
          success && !error && 'vos-input-success',
          className,
        )}
        {...rest}
      />
      <div className="flex items-center justify-between">
        {error ? (
          <span className="text-vos-xs text-vos-danger flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M6 3.5v3M6 8h.005" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {error}
          </span>
        ) : success ? (
          <span className="text-vos-xs text-vos-success flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 6l1.5 1.5L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {success}
          </span>
        ) : hint ? (
          <span className="text-vos-xs text-vos-text-muted">{hint}</span>
        ) : <span/>}
        {showCount && maxLength && (
          <span className="text-vos-2xs text-vos-text-muted">
            {rest.value?.toString().length || 0}/{maxLength}
          </span>
        )}
      </div>
    </div>
  );
});
