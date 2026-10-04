import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = { title: 'Choose a new password · Work Trail' };

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token } = await searchParams;
  const valid = typeof token === 'string' && token.length >= 20;
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <div className="mx-auto mt-16 max-w-[400px]">
          <h1 className="text-[32px] leading-[1.15]">Choose a new password</h1>
          {valid ? (
            <>
              <p className="mb-8 mt-1 text-ink-500">This signs you out on every device.</p>
              <ResetPasswordForm token={token} />
            </>
          ) : (
            <p className="mt-4 text-ink-700">
              This reset link is incomplete. Open the link from your email again, or{' '}
              <Link href="/forgot-password" className="font-semibold text-brand-700 hover:underline">
                request a new one
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </>
  );
}
