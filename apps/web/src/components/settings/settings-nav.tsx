'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export const SETTINGS_TABS = [
  { href: '/app/settings', label: 'Company' },
  { href: '/app/settings/privacy', label: 'Privacy & data' },
  { href: '/app/settings/audit', label: 'Audit log' },
  { href: '/app/settings/account', label: 'My account' },
] as const;

export function SettingsNav() {
  const path = usePathname();
  return (
    <nav aria-label="Settings sections" className="flex gap-1 border-b border-line">
      {SETTINGS_TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition',
              active
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
