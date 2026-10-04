import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { InviteForm } from '@/components/employees/invite-form';
import { inviteEmployee } from '../actions';

export const metadata: Metadata = { title: 'Invite employee · Work Trail' };

export default function InviteEmployeePage() {
  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      <Link
        href="/app/employees"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Employees
      </Link>
      <div>
        <h1 className="text-[28px] leading-tight">Invite employee</h1>
        <p className="mt-1 text-ink-500">
          They get a link to set a password, then sign in on the Work Trail app.
        </p>
      </div>
      <Card className="p-6 sm:p-8">
        <InviteForm action={inviteEmployee} />
      </Card>
    </div>
  );
}
