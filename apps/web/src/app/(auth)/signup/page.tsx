import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthPanel } from '@/components/auth/auth-panel';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = { title: 'Create company account · Work Trail' };

export default function SignupPage() {
  return (
    <>
      <AuthPanel variant="signup" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <p className="text-right text-sm text-ink-500">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
        <div className="mx-auto mt-8 max-w-[400px]">
          <h1 className="text-[32px] leading-[1.15]">Create company account</h1>
          <p className="mb-8 mt-1 text-ink-500">Get started with Work Trail</p>
          <SignupForm />
        </div>
      </section>
    </>
  );
}
