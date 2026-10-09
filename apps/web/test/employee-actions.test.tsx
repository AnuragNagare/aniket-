import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail, DataExportDto } from '@worktrail/types';
import { EmployeeActionsMenu } from '@/components/employee-detail/employee-actions-menu';
import { EraseDialog } from '@/components/employee-detail/erase-dialog';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/app/app/employees/[id]/admin-actions', () => ({
  deactivateEmployee: vi.fn().mockResolvedValue({ ok: true, data: { status: 'DISABLED' } }),
  reactivateEmployee: vi.fn().mockResolvedValue({ ok: true, data: { status: 'ACTIVE' } }),
  sendPasswordReset: vi.fn().mockResolvedValue({ ok: true }),
  requestExport: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      id: 'exp-1',
      companyId: 'c1',
      employeeId: 'e1',
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      byteSize: null,
      generatedAt: null,
      expiresAt: null,
    },
  }),
  eraseEmployee: vi.fn().mockResolvedValue({ ok: true, data: { status: 'QUEUED' } }),
}));

const mockActiveEmployee: EmployeeDetail = {
  id: 'e1',
  name: 'Anil Kumar',
  email: 'anil@example.com',
  phone: '9876543210',
  employeeCode: 'EMP001',
  designation: 'Field Officer',
  status: 'OFF_DUTY',
  account: 'ACTIVE',
  deactivated: false,
  joinedAt: '2026-01-01T00:00:00.000Z',
  workingSince: null,
  lastSeenAt: null,
  consentedAt: null,
  consentVersion: null,
};

const mockInactiveEmployee: EmployeeDetail = {
  ...mockActiveEmployee,
  deactivated: true,
};

describe('Employee actions & erasure (web)', () => {
  it('menu shows Deactivate or Reactivate depending on state', async () => {
    const user = userEvent.setup();

    // 1. Active employee -> shows Deactivate
    const { unmount } = render(<EmployeeActionsMenu employee={mockActiveEmployee} />);
    const menuBtn = screen.getByRole('button', { name: /actions/i });
    await user.click(menuBtn);
    expect(screen.getByText('Deactivate employee')).toBeInTheDocument();
    expect(screen.queryByText('Reactivate employee')).not.toBeInTheDocument();
    unmount();

    // 2. Inactive employee -> shows Reactivate
    render(<EmployeeActionsMenu employee={mockInactiveEmployee} />);
    const menuBtn2 = screen.getByRole('button', { name: /actions/i });
    await user.click(menuBtn2);
    expect(screen.getByText('Reactivate employee')).toBeInTheDocument();
    expect(screen.queryByText('Deactivate employee')).not.toBeInTheDocument();
  });

  it('erase dialog keeps Delete permanently disabled until typed name matches, and lists what is deleted vs kept', async () => {
    const user = userEvent.setup();
    const onErase = vi.fn().mockResolvedValue({ ok: true });
    const onClose = vi.fn();

    render(
      <EraseDialog
        isOpen={true}
        onClose={onClose}
        employeeName="Anil Kumar"
        employeeId="e1"
        onErase={onErase}
      />,
    );

    // Lists what will be deleted and kept
    expect(screen.getByText('What will be deleted:')).toBeInTheDocument();
    expect(screen.getByText('What is kept:')).toBeInTheDocument();
    expect(
      screen.getByText(/Work sessions, location trails, updates, summaries, reports and data exports/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Anonymised audit log rows with timestamps and actions/),
    ).toBeInTheDocument();

    const deleteBtn = screen.getByRole('button', { name: 'Delete permanently' });
    expect(deleteBtn).toBeDisabled();

    const input = screen.getByRole('textbox', { name: /type anil kumar to confirm/i });
    await user.type(input, 'Wrong Name');
    expect(deleteBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'Anil Kumar');
    expect(deleteBtn).toBeEnabled();

    await user.click(deleteBtn);
    expect(onErase).toHaveBeenCalledWith('e1', 'Anil Kumar');
  });

  it('export shows Preparing… and then a download link when ready', () => {
    // 1. Queued export -> Preparing…
    const queuedExport: DataExportDto = {
      id: 'exp-queued',
      companyId: 'c1',
      employeeId: 'e1',
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      byteSize: null,
      generatedAt: null,
      expiresAt: null,
    };
    const { unmount } = render(
      <EmployeeActionsMenu employee={mockActiveEmployee} initialExport={queuedExport} />,
    );
    expect(screen.getByText('Preparing…')).toBeInTheDocument();
    unmount();

    // 2. Ready export -> Download export link
    const readyExport: DataExportDto = {
      id: 'exp-ready',
      companyId: 'c1',
      employeeId: 'e1',
      status: 'READY',
      createdAt: new Date().toISOString(),
      byteSize: 1024,
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    render(
      <EmployeeActionsMenu employee={mockActiveEmployee} initialExport={readyExport} />,
    );
    const link = screen.getByRole('link', { name: /download export/i });
    expect(link).toHaveAttribute('href', '/api/exports/exp-ready/download');
  });
});
