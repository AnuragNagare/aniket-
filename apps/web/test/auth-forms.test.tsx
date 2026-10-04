import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { SignupForm } from '@/components/auth/signup-form';
import { LoginForm } from '@/components/auth/login-form';

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockReset();
});

async function fillSignup(phone: string) {
  await userEvent.type(screen.getByLabelText('Company name'), 'Acme Services');
  await userEvent.type(screen.getByLabelText('Your name'), 'Rahul Sharma');
  await userEvent.type(screen.getByLabelText('Email address'), 'rahul@acme.in');
  await userEvent.type(screen.getByLabelText('Mobile number'), phone);
  await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1');
}

const apiError = (code: string, message: string, status: number, fields?: object) =>
  Response.json({ error: { code, message, details: fields ? { fields } : {} } }, { status });

describe('SignupForm', () => {
  it('shows a phone error without calling the server', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    render(<SignupForm />);
    await fillSignup('12345');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(
      await screen.findByText('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a normalised +91 number and goes to the dashboard', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ user: {} }));
    render(<SignupForm />);
    await fillSignup('98765 43210');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(body.phone).toBe('+919876543210');
    expect(replace).toHaveBeenCalledWith('/app/dashboard');
  });

  it('shows a server error that has no field in an alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      apiError('EMAIL_TAKEN', 'An account with this email already exists. Sign in instead.', 409),
    );
    render(<SignupForm />);
    await fillSignup('9876543210');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists. Sign in instead.',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('puts server field errors next to their fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      apiError('VALIDATION_FAILED', 'Some fields need attention.', 400, {
        companyName: 'Enter your company name.',
      }),
    );
    render(<SignupForm />);
    await fillSignup('9876543210');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByLabelText('Company name')).toHaveAccessibleDescription(
      'Enter your company name.',
    );
  });
});

describe('LoginForm', () => {
  it('shows the server message on bad credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      apiError('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401),
    );
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'r@a.in');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(replace).not.toHaveBeenCalled();
  });

  it('tells the person when they are offline', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email address'), 'r@a.in');
    await userEvent.type(screen.getByLabelText('Password'), 'x');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i);
  });

  it('toggles password visibility', async () => {
    render(<LoginForm />);
    const pw = screen.getByLabelText('Password');
    expect(pw).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(pw).toHaveAttribute('type', 'text');
  });
});
