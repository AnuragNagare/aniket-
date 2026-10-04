'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, FileBarChart, LayoutDashboard, Settings, Users } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/employees', label: 'Employees', icon: Users },
  { href: '/app/sessions', label: 'Work sessions', icon: Clock },
  { href: '/app/reports', label: 'Reports', icon: FileBarChart },
  { href: '/app/settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 flex h-dvh w-[220px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 py-5 max-lg:hidden"
    >
      <Link href="/app/dashboard" className="mb-6 px-3">
        <Logo size="sm" />
      </Link>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center gap-3 rounded-input px-3 text-sm font-medium transition-colors',
              active ? 'bg-brand-50 text-brand-700' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
