import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: () => null }));

import { AuthPanel } from '@/components/auth/auth-panel';

describe('AuthPanel', () => {
  it('welcomes someone joining for the first time instead of "Welcome back"', () => {
    render(<AuthPanel variant="join" />);
    expect(screen.getByText(/Welcome to/)).toBeInTheDocument();
    expect(screen.queryByText(/back!/)).toBeNull();
  });

  it('keeps the welcome-back message for returning admins', () => {
    render(<AuthPanel variant="login" />);
    expect(screen.getByText('back!')).toBeInTheDocument();
  });
});
