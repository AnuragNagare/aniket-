'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Download, Lock, UserX, UserCheck, Trash2 } from 'lucide-react';
import type { DataExportDto, EmployeeDetail } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/auth/form-alert';
import { EraseDialog } from './erase-dialog';
import {
  deactivateEmployee,
  reactivateEmployee,
  sendPasswordReset,
  requestExport,
  eraseEmployee,
} from '@/app/app/employees/[id]/admin-actions';

type Props = {
  employee: EmployeeDetail;
  initialExport?: DataExportDto | null;
};

export function EmployeeActionsMenu({ employee, initialExport }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);
  const [exportState, setExportState] = useState<DataExportDto | null>(initialExport ?? null);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDeactivated = employee.status === 'INACTIVE' || employee.status === 'INVITED';

  const handleDeactivate = async () => {
    setError(null);
    setFeedback(null);
    const res = await deactivateEmployee(employee.id);
    if (res.ok) {
      setFeedback('Employee deactivated.');
      router.refresh();
    } else {
      setError(res.message);
    }
    setMenuOpen(false);
  };

  const handleReactivate = async () => {
    setError(null);
    setFeedback(null);
    const res = await reactivateEmployee(employee.id);
    if (res.ok) {
      setFeedback('Employee reactivated.');
      router.refresh();
    } else {
      setError(res.message);
    }
    setMenuOpen(false);
  };

  const handleResetPassword = async () => {
    setError(null);
    setFeedback(null);
    const res = await sendPasswordReset(employee.id);
    if (res.ok) {
      setFeedback('Password reset link sent.');
    } else {
      setError(res.message);
    }
    setMenuOpen(false);
  };

  const handleExport = async () => {
    setError(null);
    setFeedback(null);
    setExporting(true);
    const res = await requestExport(employee.id);
    setExporting(false);
    if (res.ok) {
      setExportState(res.data);
      setFeedback('Export requested.');
    } else {
      setError(res.message);
    }
    setMenuOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      {feedback && <div className="text-xs text-brand-600 mb-1">{feedback}</div>}
      {error && <div className="text-xs text-danger mb-1">{error}</div>}

      <div className="flex items-center gap-2">
        {exporting && <span className="text-xs text-ink-500">Preparing…</span>}
        {exportState && exportState.status === 'READY' && (
          <a
            href={`/api/exports/${exportState.id}/download`}
            download
            className="inline-flex items-center gap-1.5 rounded-button bg-surface border border-line px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
          >
            <Download className="size-3.5" /> Download export
          </a>
        )}
        {exportState && (exportState.status === 'QUEUED' || exportState.status === 'GENERATING') && (
          <span className="text-xs text-ink-500">Preparing…</span>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Actions"
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="size-4" />
        </Button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-panel border border-line bg-surface p-1 shadow-card">
            {isDeactivated ? (
              <button
                type="button"
                onClick={handleReactivate}
                className="flex w-full items-center gap-2 rounded-input px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 text-left"
              >
                <UserCheck className="size-4" /> Reactivate employee
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDeactivate}
                className="flex w-full items-center gap-2 rounded-input px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 text-left"
              >
                <UserX className="size-4" /> Deactivate employee
              </button>
            )}

            <button
              type="button"
              onClick={handleResetPassword}
              className="flex w-full items-center gap-2 rounded-input px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 text-left"
            >
              <Lock className="size-4" /> Send password reset
            </button>

            <button
              type="button"
              onClick={handleExport}
              className="flex w-full items-center gap-2 rounded-input px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 text-left"
            >
              <Download className="size-4" /> Export data
            </button>

            <div className="my-1 border-t border-line" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setEraseOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-input px-3 py-2 text-sm text-danger hover:bg-danger/10 text-left"
            >
              <Trash2 className="size-4" /> Delete employee data…
            </button>
          </div>
        </>
      )}

      <EraseDialog
        isOpen={eraseOpen}
        onClose={() => setEraseOpen(false)}
        employeeName={employee.name}
        employeeId={employee.id}
        onErase={eraseEmployee}
        onSuccess={() => {
          router.push('/app/employees');
        }}
      />
    </div>
  );
}
