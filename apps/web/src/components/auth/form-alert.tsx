/** Form-level error (not tied to one field), announced to screen readers. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-input border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-ink-900">
      {message}
    </p>
  );
}
