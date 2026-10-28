'use client';

import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cx } from './cx';
import { Icon } from './icons';

const CONTROL =
  'block w-full min-h-control rounded-control border border-border-control bg-surface px-3 text-ink transition-colors duration-fast placeholder:text-ink-muted hover:border-ink-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 aria-[invalid=true]:border-danger disabled:bg-surface-muted disabled:text-ink-muted';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode;
}

export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('min-w-0', className)}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1.5 text-body-s font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-muted">optional</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-body-s text-ink-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1 text-body-s text-danger-text">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; suffix?: ReactNode; fieldClassName?: string };

export function TextField({ label, hint, error, optional, suffix, fieldClassName, className, ...rest }: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      {(a11y) =>
        suffix ? (
          <div className="relative">
            <input {...a11y} {...rest} className={cx(CONTROL, 'pr-16', className)} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-body-s text-ink-muted">{suffix}</span>
          </div>
        ) : (
          <input {...a11y} {...rest} className={cx(CONTROL, className)} />
        )
      }
    </Field>
  );
}

export function PasswordField(props: Omit<InputProps, 'type'>) {
  const [shown, setShown] = useState(false);
  const { label, hint, error, optional, fieldClassName, className, ...rest } = props;
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      {(a11y) => (
        <div className="relative">
          <input {...a11y} {...rest} type={shown ? 'text' : 'password'} className={cx(CONTROL, 'pr-12', className)} />
          <button type="button" onClick={() => setShown((s) => !s)} className="absolute inset-y-0 right-1 my-1 grid w-10 place-items-center rounded-control text-ink-secondary hover:text-ink" aria-label={shown ? 'Hide' : 'Show'} aria-pressed={shown}>
            <Icon name={shown ? 'eyeOff' : 'eye'} />
          </button>
        </div>
      )}
    </Field>
  );
}

export function SelectField({ label, hint, error, optional, fieldClassName, className, children, ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; fieldClassName?: string; children: ReactNode }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      {(a11y) => (
        <div className="relative">
          <select {...a11y} {...rest} className={cx(CONTROL, 'appearance-none pr-9', className)}>
            {children}
          </select>
          <Icon name="chevronDown" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
        </div>
      )}
    </Field>
  );
}

export function TextAreaField({ label, hint, error, optional, fieldClassName, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode; error?: string; optional?: boolean; fieldClassName?: string }) {
  return (
    <Field label={label} hint={hint} error={error} optional={optional} className={fieldClassName}>
      {(a11y) => <textarea {...a11y} {...rest} className={cx(CONTROL, 'min-h-[5.5rem] py-2.5', className)} />}
    </Field>
  );
}

export function CheckboxField({ label, hint, error, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; hint?: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input id={id} type="checkbox" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined} className="mt-0.5 size-[1.125rem] shrink-0 rounded-xs border-border-control" {...rest} />
        <span className="text-body-s">
          <span className="text-ink">{label}</span>
          {hint && <span className="mt-0.5 block text-ink-secondary">{hint}</span>}
        </span>
      </label>
      {error && (
        <p id={`${id}-e`} className="ml-8 mt-1 text-body-s text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

/** Exact decimal entry: text input, never a number spinner, so 0.1 stays 0.1. */
export function DecimalField({ maxDecimals, ...props }: Omit<InputProps, 'type' | 'inputMode'> & { maxDecimals: number }) {
  return <TextField {...props} type="text" inputMode="decimal" autoComplete="off" pattern={`^-?\\d+(\\.\\d{1,${maxDecimals}})?$`} />;
}

export function ChoiceCards<T extends string>({ name, value, onChange, options, legend }: { name: string; value: T; onChange: (v: T) => void; legend: string; options: { value: T; label: string; description?: string; disabled?: boolean; badge?: string }[] }) {
  return (
    <fieldset>
      <legend className="mb-2 text-body-s font-medium">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className={cx('flex cursor-pointer gap-3 rounded-row border p-3.5 transition-colors duration-fast', value === o.value ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong', o.disabled && 'cursor-not-allowed opacity-60')}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} className="mt-1 shrink-0" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-body-s font-semibold">
                {o.label}
                {o.badge && <span className="rounded-pill bg-surface-strong px-2 py-0.5 text-micro font-medium text-ink-secondary">{o.badge}</span>}
              </span>
              {o.description && <span className="mt-0.5 block text-body-s text-ink-secondary">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
