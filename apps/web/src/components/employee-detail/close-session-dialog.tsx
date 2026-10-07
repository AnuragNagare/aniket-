'use client';

import { useState } from 'react';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { AdminSessionDto } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  employeeId: string;
  session: Pick<AdminSessionDto, 'id' | 'startedAt' | 'lastLocationAt'>;
  timezone: string;
  action: (employeeId: string, sessionId: string, endedAt: string) => Promise<MutationResult<AdminSessionDto>>;
  onDone: () => void;
};

const LOCAL = "yyyy-MM-dd'T'HH:mm";

/** Ends a forgotten session. Defaults to the last moment we had a location for them. */
export function CloseSessionDialog({ employeeId, session, timezone, action, onDone }: Props) {
  const initial = session.lastLocationAt ?? session.startedAt;
  const [value, setValue] = useState(formatInTimeZone(new Date(initial), timezone, LOCAL));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const endedAt =
      value === formatInTimeZone(new Date(initial), timezone, LOCAL)
        ? initial
        : fromZonedTime(value, timezone).toISOString();
    const r = await action(employeeId, session.id, endedAt);
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.message);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="close-title" className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 p-4">
      <div className="w-full max-w-md space-y-4 rounded-panel bg-surface p-6 shadow-card">
        <h2 id="close-title" className="text-xl">Close this work session</h2>
        <p className="text-sm text-ink-700">
          Choose when the employee actually stopped working. The session will be marked “Closed by admin”, and this is recorded in the audit log.
        </p>
        <label htmlFor="close-end" className="block text-sm font-medium text-ink-900">
          End time
        </label>
        <input
          id="close-end"
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 w-full rounded-input border border-line px-3"
        />
        <FormAlert message={error} />
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void submit()}>
            Close session
          </Button>
        </div>
      </div>
    </div>
  );
}
