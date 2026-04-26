'use client';

import { useId, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { prefersReducedMotion } from '@/lib/utils';

export default function FloatingLabelInput({
  label,
  value,
  onChange,
  type = 'text',
  name,
  id,
  autoComplete,
  disabled,
  required,
  inputMode,
  error,
  success,
  isChecking,
  rightHint,
  className,
  inputClassName,
  onBlur,
  onFocus,
  ...rest
}) {
  const uid = useId();
  const inputId = id || `${name || 'fld'}-${uid}`;
  const [showPassword, setShowPassword] = useState(false);
  const reduce = useMemo(() => prefersReducedMotion(), []);

  const isPassword = type === 'password';
  const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;
  const hasValue = value != null && String(value).length > 0;
  const showSuccess = Boolean(success && !error && !isChecking && hasValue);
  const showError = Boolean(error);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'group relative rounded-2xl border bg-ui-panel px-4 pb-3 pt-5 transition duration-200',
          'shadow-[var(--shadow-soft)]',
          showError ? 'border-red-500/70' : 'border-ui-border',
          showSuccess ? 'border-emerald-500/70' : null,
          disabled ? 'opacity-70' : null,
          'focus-within:border-ui-accent focus-within:shadow-[0_0_0_4px_var(--ui-focus)]'
        )}
      >
        <label
          htmlFor={inputId}
          className={cn(
            'pointer-events-none absolute left-4 top-4 origin-left select-none text-sm text-[color:var(--ui-fg-muted)] transition-all duration-200',
            'group-focus-within:text-[color:var(--ui-accent-text)]',
            hasValue ? '-translate-y-2 scale-[0.86]' : null,
            'group-focus-within:-translate-y-2 group-focus-within:scale-[0.86]'
          )}
        >
          {label}
        </label>

        <input
          id={inputId}
          name={name}
          type={actualType}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          inputMode={inputMode}
          onBlur={onBlur}
          onFocus={onFocus}
          className={cn(
            'mt-1 block w-full bg-transparent text-[15px] text-[color:var(--ui-fg)] outline-none placeholder:text-transparent',
            'selection:bg-[var(--ui-accent-subtle)]',
            inputClassName
          )}
          placeholder={label}
          {...rest}
        />

        <div className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--ui-fg-muted)]" aria-hidden="true" />
          ) : null}
          {showSuccess ? <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : null}
        </div>

        {isPassword ? (
          <button
            type="button"
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[color:var(--ui-fg-muted)]',
              'transition hover:bg-ui-muted hover:text-[color:var(--ui-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ui-canvas)]'
            )}
            onClick={() => setShowPassword((s) => !s)}
            tabIndex={0}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {showError ? (
        <div
          className={cn(
            'mt-2 text-sm text-red-600',
            reduce ? null : 'motion-safe:animate-[dlite_shake_0.35s_ease-in-out_1]'
          )}
          role="alert"
        >
          {String(error)}
        </div>
      ) : rightHint ? (
        <div className="mt-2 text-sm text-[color:var(--ui-fg-muted)]">{rightHint}</div>
      ) : null}
    </div>
  );
}

