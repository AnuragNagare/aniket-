import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CompanyForm } from '@/components/settings/company-form';
import { RetentionForm } from '@/components/settings/retention-form';
import { SettingsNav } from '@/components/settings/settings-nav';
import { AuditTable } from '@/components/settings/audit-table';
import type { AuditLogItem } from '@worktrail/types';


vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings',
}));

describe('SettingsNav', () => {
  it('renders all four settings tabs', () => {
    render(<SettingsNav />);
    expect(screen.getByRole('link', { name: 'Company' })).toHaveAttribute('href', '/app/settings');
    expect(screen.getByRole('link', { name: 'Privacy & data' })).toHaveAttribute('href', '/app/settings/privacy');
    expect(screen.getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/app/settings/audit');
    expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/app/settings/account');
  });
});

describe('RetentionForm', () => {
  it("warns 'Locations older than 60 days will be deleted tonight. This can't be undone.' before saving when the number goes down", async () => {
    const action = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'c1',
        name: 'Acme Corp',
        timezone: 'Asia/Kolkata',
        preciseLocationRetentionDays: 60,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    render(<RetentionForm initialDays={90} action={action} />);

    const input = screen.getByLabelText(/Precise location retention/);
    expect(input).toHaveValue(90);

    // Warning is not initially visible
    expect(
      screen.queryByText(/Locations older than 60 days will be deleted tonight\. This can't be undone\./),
    ).not.toBeInTheDocument();

    // Type 60 (decreasing retention)
    await userEvent.clear(input);
    await userEvent.type(input, '60');

    // Warning should now be prominently displayed
    expect(
      await screen.findByText("Locations older than 60 days will be deleted tonight. This can't be undone."),
    ).toBeInTheDocument();

    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ preciseLocationRetentionDays: 60 }),
    );
  });

  it('does not show warning when retention days is increased', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: {} });
    render(<RetentionForm initialDays={90} action={action} />);

    const input = screen.getByLabelText(/Precise location retention/);
    await userEvent.clear(input);
    await userEvent.type(input, '120');

    expect(
      screen.queryByText(/will be deleted tonight\. This can't be undone\./),
    ).not.toBeInTheDocument();
  });
});

describe('CompanyForm', () => {
  it('shows field errors when server returns validation errors', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: false,
      message: 'Validation failed',
      fields: {
        name: 'This company name is already registered.',
      },
    });

    render(
      <CompanyForm
        initial={{ name: 'Acme Corp', timezone: 'Asia/Kolkata' }}
        action={action}
      />,
    );

    const nameInput = screen.getByLabelText('Company name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Existing Company');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(action).toHaveBeenCalled();
    expect(await screen.findByText('This company name is already registered.')).toBeInTheDocument();
  });

  it('shows field error on invalid client input', async () => {
    const action = vi.fn();
    render(
      <CompanyForm
        initial={{ name: 'Acme Corp', timezone: 'Asia/Kolkata' }}
        action={action}
      />,
    );

    const nameInput = screen.getByLabelText('Company name');
    await userEvent.clear(nameInput);

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Company name is required.')).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });
});

describe('AuditTable', () => {
  it('renders the empty state "Nothing recorded in this period."', () => {
    render(<AuditTable items={[]} />);
    expect(screen.getByText('Nothing recorded in this period.')).toBeInTheDocument();
  });

  it('renders the label, actor, date in IST and IP', () => {
    const items: AuditLogItem[] = [
      {
        id: 'log-1',
        action: 'report.downloaded',
        label: 'Downloaded a PDF report',
        actorName: 'Alice Admin',
        entityType: 'report',
        entityName: 'Ravi Kumar report',
        createdAt: '2026-10-08T09:30:00.000Z',
        ip: '203.0.113.42',
        details: { format: 'pdf', byteSize: 2048 },
      },
    ];

    render(<AuditTable items={items} timezone="Asia/Kolkata" />);

    expect(screen.getByText('Downloaded a PDF report')).toBeInTheDocument();
    expect(screen.getByText('Alice Admin')).toBeInTheDocument();
    expect(screen.getByText('Ravi Kumar report')).toBeInTheDocument();
    // 09:30:00 UTC is 15:00 (3:00 PM) in Asia/Kolkata
    expect(screen.getByText(/8 Oct 2026, 3:00 pm/i)).toBeInTheDocument();
    expect(screen.getByText('203.0.113.42')).toBeInTheDocument();
  });
});

