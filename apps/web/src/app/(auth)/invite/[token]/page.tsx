import type { Metadata } from 'next';
import type { InvitationPreview } from '@worktrail/types';
import { AuthPanel } from '@/components/auth/auth-panel';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';
import { publicGet } from '@/lib/public-api';

export const metadata: Metadata = { title: 'Join your team · Work Trail' };

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  const result = await publicGet<InvitationPreview>(
    `/employees/invitations/${encodeURIComponent(token)}`,
  );
  return (
    <>
      <AuthPanel variant="login" />
      <section className="px-6 py-8 sm:px-14 sm:py-10">
        <div className="mx-auto mt-16 max-w-[400px]">
          {result.ok ? (
            <>
              <h1 className="text-[32px] leading-[1.15]">Join {result.data.companyName}</h1>
              <p className="mb-8 mt-1 text-ink-500">
                Set a password for {result.data.email}. You&apos;ll use it to sign in on the Work
                Trail app.
              </p>
              <AcceptInviteForm token={token} preview={result.data} />
            </>
          ) : (
            <>
              <h1 className="text-[32px] leading-[1.15]">This invite link doesn&apos;t work</h1>
              <p className="mt-3 text-ink-700">
                {result.status === 503
                  ? 'Work Trail is not reachable right now. Try the link again in a moment.'
                  : 'It has expired or was already used. Ask your admin to send you a new invite link.'}
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
