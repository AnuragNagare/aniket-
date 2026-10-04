import { initials } from '@/lib/format';

/** Initials avatar (no photos are stored in the MVP). */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700"
    >
      {initials(name)}
    </span>
  );
}
