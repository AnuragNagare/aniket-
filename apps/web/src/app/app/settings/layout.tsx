import type { Metadata } from 'next';
import { SettingsNav } from '@/components/settings/settings-nav';

export const metadata: Metadata = { title: 'Settings · Work Trail' };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold text-ink-900">Settings</h1>
        <p className="mt-1 text-ink-500">
          Manage your company settings, data retention, security, and audit logs.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
