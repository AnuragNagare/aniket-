import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Sign in · Work Trail' };

export default function LoginPage() {
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <p className="text-right text-sm text-ink-500">
          New to Work Trail?{' '}
          <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
            Create company account
          </Link>
        </p>
        <div className="mx-auto mt-16 max-w-[400px]">
          <h1 className="text-[32px] leading-[1.15]">Sign in</h1>
          <p className="mb-8 mt-1 text-ink-500">Welcome back to Work Trail</p>
          <LoginForm />
        </div>
      </section>
    </>
  );
}
