'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { DeletionRequestDto } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { dismissDeletionRequestAction } from '@/app/app/settings/actions';

type Props = {
  requests: DeletionRequestDto[];
};

export function DeletionRequestsTable({ requests }: Props) {
  const router = useRouter();
  const [selectedDismissId, setSelectedDismissId] = useState<string | null>(null);
  const [dismissNote, setDismissNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openRequests = requests.filter((r) => r.status === 'OPEN');

  const handleDismiss = async () => {
    if (!selectedDismissId) return;
    setBusy(true);
    setError(null);
    const res = await dismissDeletionRequestAction(selectedDismissId, dismissNote);
    setBusy(false);
    if (res.ok) {
      setSelectedDismissId(null);
      setDismissNote('');
      router.refresh();
    } else {
      setError(res.message);
    }
  };

  if (openRequests.length === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface p-6 text-center text-sm text-ink-500">
        No open deletion requests.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-panel border border-line bg-surface overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs text-ink-500 uppercase border-b border-line">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {openRequests.map((req) => (
              <tr key={req.id} className="hover:bg-ink-50/50">
                <td className="px-4 py-3 font-medium text-ink-900">
                  {req.employeeName ?? req.employeeId}
                </td>
                <td className="px-4 py-3 text-ink-700">
                  {req.reason || <span className="text-ink-400 italic">None specified</span>}
                </td>
                <td className="px-4 py-3 text-ink-500">
                  {new Date(req.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <Link
                    href={`/app/employees/${req.employeeId}`}
                    className="inline-flex items-center rounded-button border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Open employee
                  </Link>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSelectedDismissId(req.id);
                      setDismissNote('');
                      setError(null);
                    }}
                  >
                    Dismiss
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDismissId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/30 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-panel bg-surface p-6 shadow-card">
            <h3 className="text-lg font-semibold text-ink-900">Dismiss deletion request</h3>
            <p className="text-sm text-ink-600">
              Provide an optional note explaining why this request is being dismissed.
            </p>
            <textarea
              value={dismissNote}
              onChange={(e) => setDismissNote(e.target.value)}
              placeholder="e.g., Verification pending, contacted employee directly..."
              className="w-full rounded-input border border-line p-2.5 text-sm"
              rows={3}
            />
            <FormAlert message={error} />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDismissId(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDismiss}
                disabled={busy}
              >
                {busy ? 'Dismissing…' : 'Confirm dismiss'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
