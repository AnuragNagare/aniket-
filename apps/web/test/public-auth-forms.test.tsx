import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';

afterEach(() => vi.restoreAllMocks());

const TOKEN = 't'.repeat(43);

describe('ForgotPasswordForm', () => {
  it('confirms without revealing whether the account exists', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'r@a.in');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(
      await screen.findByText(
        'If r@a.in has a Work Trail account, a reset link is on its way. It expires in 1 hour.',
      ),
    ).toBeInTheDocument();
  });
});

describe('ResetPasswordForm', () => {
  async function fill(password: string, confirm: string) {
    await userEvent.type(screen.getByLabelText('New password'), password);
    await userEvent.type(screen.getByLabelText('Confirm new password'), confirm);
    await userEvent.click(screen.getByRole('button', { name: /save new password/i }));
  }

  it('checks that both passwords match before calling the server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<ResetPasswordForm token={TOKEN} />);
    await fill('NewStrongPass2', 'Different1');
    expect(await screen.findByText('The passwords do not match.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirms the change and links to sign-in', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    render(<ResetPasswordForm token={TOKEN} />);
    await fill('NewStrongPass2', 'NewStrongPass2');
    expect(await screen.findByText(/Password saved\. Sign in with your new password\./)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('shows the expired-link message from the server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'RESET_LINK_INVALID',
            message: 'This reset link has expired or was already used. Request a new one.',
            details: {},
          },
        },
        { status: 400 },
      ),
    );
    render(<ResetPasswordForm token={TOKEN} />);
    await fill('NewStrongPass2', 'NewStrongPass2');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link has expired or was already used. Request a new one.',
    );
  });
});

describe('AcceptInviteForm', () => {
  const preview = {
    companyName: 'Acme Services',
    employeeName: 'Ravi Kumar',
    email: 'ravi@example.com',
    expiresAt: '2026-10-11T00:00:00Z',
  };

  it('pre-fills the name and, after accepting, points to the app', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({ user: { name: 'Ravi Kumar', email: 'ravi@example.com' } }),
    );
    render(<AcceptInviteForm token="tok" preview={preview} />);
    expect(screen.getByLabelText('Your name')).toHaveValue('Ravi Kumar');
    await userEvent.type(screen.getByLabelText('Create a password'), 'StrongPass1');
    await userEvent.click(screen.getByRole('button', { name: /join acme services/i }));
    expect(await screen.findByText("You're in, Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText(/sign in on the Work Trail app with ravi@example.com/i)).toBeInTheDocument();
  });

  it('shows a used-link error from the server', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'INVITE_INVALID',
            message: 'This invite link has expired or was already used. Ask your admin for a new one.',
            details: {},
          },
        },
        { status: 410 },
      ),
    );
    render(<AcceptInviteForm token="tok" preview={preview} />);
    await userEvent.type(screen.getByLabelText('Create a password'), 'StrongPass1');
    await userEvent.click(screen.getByRole('button', { name: /join acme services/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/expired or was already used/);
  });
});
