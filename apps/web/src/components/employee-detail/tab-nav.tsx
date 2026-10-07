'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { slug: '', label: 'Overview' },
  { slug: '/map', label: 'Map' },
  { slug: '/updates', label: 'Updates' },
  { slug: '/hours', label: 'Work hours' },
  { slug: '/reports', label: 'Reports' },
];

export function TabNav({ id }: { id: string }) {
  const path = usePathname();
  const qs = useSearchParams().toString();
  const base = `/app/employees/${id}`;
  return (
    <nav aria-label="Employee sections" className="flex gap-1 border-b border-line">
      {TABS.map((t) => {
        const href = `${base}${t.slug}`;
        const active = path === href;
        return (
          <Link
            key={t.label}
            href={qs ? `${href}?${qs}` : href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold',
              active ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
