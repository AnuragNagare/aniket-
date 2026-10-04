'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import type { AuthUser } from '@worktrail/types';
import { Avatar } from '@/components/dashboard/avatar';
import { Logo } from '@/components/ui/logo';

const ROLE_LABEL = { OWNER: 'Owner', ADMIN: 'Admin', EMPLOYEE: 'Employee' } as const;

export function Topbar({ user }: { user: AuthUser }) {
  const router = useRouter();

  const signOut = async () => {
    await fetch('/api/session/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="flex h-16 items-center gap-4 border-b border-line bg-surface px-6">
      <Logo size="sm" className="lg:hidden" />
      <div className="ml-auto flex items-center gap-3">
        <Avatar name={user.name} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="text-xs text-ink-500">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="inline-flex h-10 items-center gap-2 rounded-input px-3 text-sm font-medium text-ink-500 hover:bg-brand-50 hover:text-ink-900"
      >
        <LogOut className="size-[18px]" aria-hidden />
        Sign out
      </button>
    </header>
  );
}
