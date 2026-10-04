'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import type { InvitationCreated } from '@worktrail/types';

export function whatsappHref(inviteUrl: string) {
  const text = `Join our team on Work Trail. Set your password here: ${inviteUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Shown after an invite is created: the link, plus copy and WhatsApp share. */
export function InviteLinkPanel({ invitation, name }: { invitation: InvitationCreated; name: string }) {
  const [copied, setCopied] = useState(false);
  const expires = formatInTimeZone(new Date(invitation.expiresAt), 'Asia/Kolkata', 'd MMM yyyy');

  const copy = async () => {
    await navigator.clipboard.writeText(invitation.inviteUrl);
    setCopied(true);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl">Invite sent to {name}</h2>
      <p className="text-ink-500">
        {invitation.emailSent
          ? `We emailed the link. You can also share it on WhatsApp. It works once and expires on ${expires}.`
          : `We couldn't email the invite, so share this link with ${name} yourself. It works once and expires on ${expires}.`}
      </p>
      <div className="space-y-1.5">
        <label htmlFor="invite-link" className="block text-sm font-medium text-ink-900">
          Invite link
        </label>
        <div className="flex gap-2">
          <input
            id="invite-link"
            readOnly
            value={invitation.inviteUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-12 min-w-0 flex-1 rounded-input border border-line bg-canvas px-3 text-sm text-ink-700"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-12 items-center gap-2 rounded-input border border-brand-200 bg-surface px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>
      <a
        href={whatsappHref(invitation.inviteUrl)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-12 items-center gap-2 rounded-input bg-success-500 px-5 text-sm font-semibold text-white"
      >
        <MessageCircle className="size-[18px]" aria-hidden />
        Share on WhatsApp
      </a>
    </div>
  );
}
