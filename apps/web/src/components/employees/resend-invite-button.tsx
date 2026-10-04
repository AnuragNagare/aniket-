'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';
import type { InvitationCreated } from '@worktrail/types';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  employeeId: string;
  name: string;
  action: (employeeId: string) => Promise<MutationResult<InvitationCreated>>;
};

type State = { kind: 'idle' | 'busy' | 'copied' } | { kind: 'error'; message: string };

/** Issues a fresh invite link (the old one stops working) and copies it. */
export function ResendInviteButton({ employeeId, name, action }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const run = async () => {
    setState({ kind: 'busy' });
    const result = await action(employeeId);
    if (!result.ok) return setState({ kind: 'error', message: result.message });
    await navigator.clipboard.writeText(result.data.inviteUrl).catch(() => undefined);
    setState({ kind: 'copied' });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={state.kind === 'busy'}
        aria-label={`Copy new invite link for ${name}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-input px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
      >
        <Link2 className="size-4" aria-hidden />
        {state.kind === 'copied' ? 'New link copied' : 'Copy new invite link'}
      </button>
      {state.kind === 'error' ? (
        <span role="alert" className="text-xs text-danger-500">
          {state.message}
        </span>
      ) : null}
    </span>
  );
}
