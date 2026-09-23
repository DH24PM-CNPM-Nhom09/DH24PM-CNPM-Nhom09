import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

interface FieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
}

const inputBase =
  "w-full rounded-input border border-gray-300 px-[14px] py-[12px] text-sm text-gray-900 outline-none transition-colors focus:border-accent";

export function Field({ label, required, error, hint, children }: FieldProps & { children: ReactNode }) {
  return (
    <label className="flex w-full flex-col gap-1.5">
      {label && (
        <span className="text-[13px] font-semibold text-gray-700">
          {label} {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="text-xs text-gray-400">{hint}</span>}
      {error && <span className="text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const { label, required, error, hint, className = "", ...rest } = props;
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <input className={`${inputBase} ${error ? "border-danger" : ""} ${className}`} {...rest} />
    </Field>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps) {
  const { label, required, error, hint, className = "", ...rest } = props;
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <textarea className={`${inputBase} min-h-[110px] resize-y ${className}`} {...rest} />
    </Field>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement> & FieldProps & { children: ReactNode }) {
  const { label, required, error, hint, className = "", children, ...rest } = props;
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <select className={`${inputBase} bg-white ${className}`} {...rest}>
        {children}
      </select>
    </Field>
  );
}
