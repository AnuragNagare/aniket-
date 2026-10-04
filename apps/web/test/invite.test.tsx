import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvitationCreated } from '@worktrail/types';
import { InviteForm } from '@/components/employees/invite-form';
import { ResendInviteButton } from '@/components/employees/resend-invite-button';

const created: InvitationCreated = {
  employeeId: 'e1',
  inviteUrl: 'http://localhost:3000/invite/abc',
  expiresAt: '2026-10-11T10:00:00.000Z',
  emailSent: true,
};
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => vi.clearAllMocks());

async function fill() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Ravi Kumar');
  await userEvent.type(screen.getByLabelText('Email address'), 'ravi@example.com');
  await userEvent.type(screen.getByLabelText(/Mobile number/), '98765 43210');
}
const submit = () => userEvent.click(screen.getByRole('button', { name: /send invite/i }));

describe('InviteForm', () => {
  it('validates before calling the server', async () => {
    const action = vi.fn();
    render(<InviteForm action={action} />);
    await submit();
    expect(await screen.findByText("Enter the employee's name.")).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it('sends normalised values and then shows the link to share', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: created });
    render(<InviteForm action={action} />);
    await fill();
    await submit();
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ravi@example.com', phone: '+919876543210' }),
    );
    expect(await screen.findByText('Invite sent to Ravi Kumar')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Invite link' })).toHaveValue(created.inviteUrl);
    expect(screen.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(
        `Join our team on Work Trail. Set your password here: ${created.inviteUrl}`,
      )}`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(created.inviteUrl);
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('says when the email could not be sent, so the admin shares the link', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: { ...created, emailSent: false } });
    render(<InviteForm action={action} />);
    await fill();
    await submit();
    expect(await screen.findByText(/couldn't email the invite/i)).toBeInTheDocument();
  });

  it('puts a server error on the right field', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: false,
      message: 'Some fields need attention.',
      fields: { email: 'This email already has a Work Trail account. Use a different email.' },
    });
    render(<InviteForm action={action} />);
    await fill();
    await submit();
    expect(await screen.findByLabelText('Email address')).toHaveAccessibleDescription(
      'This email already has a Work Trail account. Use a different email.',
    );
  });

  it('shows a server error that has no field', async () => {
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, message: 'This person is already on your team.', fields: {} });
    render(<InviteForm action={action} />);
    await fill();
    await submit();
    expect(await screen.findByRole('alert')).toHaveTextContent('This person is already on your team.');
  });
});

describe('ResendInviteButton', () => {
  it('creates a new link and copies it', async () => {
    const action = vi.fn().mockResolvedValue({ ok: true, data: created });
    render(<ResendInviteButton employeeId="e1" name="Ravi Kumar" action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Copy new invite link for Ravi Kumar' }));
    expect(action).toHaveBeenCalledWith('e1');
    expect(writeText).toHaveBeenCalledWith(created.inviteUrl);
    expect(await screen.findByText('New link copied')).toBeInTheDocument();
  });

  it('shows the failure next to the button', async () => {
    const action = vi.fn().mockResolvedValue({
      ok: false,
      message: 'This employee has already set up their account.',
      fields: {},
    });
    render(<ResendInviteButton employeeId="e1" name="Ravi Kumar" action={action} />);
    await userEvent.click(screen.getByRole('button', { name: /copy new invite link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This employee has already set up their account.',
    );
  });
});
