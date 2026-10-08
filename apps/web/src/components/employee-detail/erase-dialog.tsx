'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeId: string;
  onErase: (employeeId: string, confirmName: string) => Promise<MutationResult<any>>;
  onSuccess?: () => void;
};

export function EraseDialog({
  isOpen,
  onClose,
  employeeName,
  employeeId,
  onErase,
  onSuccess,
}: Props) {
  const [typedName, setTypedName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const matches = typedName.trim() === employeeName.trim();

  const handleErase = async () => {
    if (!matches) return;
    setBusy(true);
    setError(null);
    const res = await onErase(employeeId, typedName);
    setBusy(false);
    if (res.ok) {
      if (onSuccess) onSuccess();
      onClose();
    } else {
      setError(res.message);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="erase-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
    >
      <div className="w-full max-w-md space-y-4 rounded-panel bg-surface p-6 shadow-card">
        <h2 id="erase-dialog-title" className="text-xl font-semibold text-danger">
          Permanently delete employee data
        </h2>
        <p className="text-sm text-ink-700">
          This action cannot be undone. All personal data associated with{' '}
          <strong>{employeeName}</strong> will be permanently wiped.
        </p>

        <div className="rounded-input bg-ink-50 p-3 text-xs space-y-2 text-ink-700">
          <div>
            <strong className="text-ink-900">What will be deleted:</strong>
            <p>Work sessions, location trails, updates, summaries, reports and data exports.</p>
          </div>
          <div>
            <strong className="text-ink-900">What is kept:</strong>
            <p>Anonymised audit log rows with timestamps and actions, without names or personal data.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm-employee-name" className="block text-sm font-medium text-ink-900">
            Type <strong>{employeeName}</strong> to confirm:
          </label>
          <input
            id="confirm-employee-name"
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={employeeName}
            className="h-11 w-full rounded-input border border-line px-3 text-sm"
          />
        </div>

        <FormAlert message={error} />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={handleErase}
            disabled={!matches || busy}
            className="inline-flex h-11 items-center justify-center rounded-button bg-danger px-4 text-sm font-medium text-white transition hover:bg-danger/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Deleting…' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
