import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata: Metadata = { title: 'Reset your password · Work Trail' };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <p className="text-right text-sm text-ink-500">
          Remembered it?{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
        <div className="mx-auto mt-16 max-w-[400px]">
          <h1 className="text-[32px] leading-[1.15]">Reset your password</h1>
          <p className="mb-8 mt-1 text-ink-500">
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
          <ForgotPasswordForm />
        </div>
      </section>
    </>
  );
}
