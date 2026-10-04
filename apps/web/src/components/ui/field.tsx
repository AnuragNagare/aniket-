import { Children, cloneElement, isValidElement } from 'react';

type Props = {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: React.ReactElement;
};

/** Label + control + message. Wires aria-invalid / aria-describedby onto the control. */
export function Field({ label, htmlFor, error, hint, children }: Props) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const child = Children.only(children);
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-900">
        {label}
      </label>
      {isValidElement<React.InputHTMLAttributes<HTMLInputElement>>(child)
        ? cloneElement(child, {
            'aria-invalid': error ? true : undefined,
            'aria-describedby': describedBy,
          })
        : child}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger-500">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
