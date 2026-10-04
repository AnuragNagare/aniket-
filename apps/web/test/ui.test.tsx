import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Logo } from '@/components/ui/logo';

describe('ui primitives', () => {
  it('primary button is disabled and marked busy while loading', () => {
    render(<Button loading>Create account</Button>);
    const btn = screen.getByRole('button', { name: /create account/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('field links its error to the input for screen readers', () => {
    render(
      <Field label="Mobile number" htmlFor="phone" error="Enter a 10-digit mobile number">
        <Input id="phone" />
      </Field>,
    );
    const input = screen.getByLabelText('Mobile number');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a 10-digit mobile number');
  });

  it('segmented tabs skip disabled options', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedTabs
        value="email"
        onChange={onChange}
        label="Sign-in method"
        options={[
          { value: 'email', label: 'Email' },
          { value: 'otp', label: 'Mobile OTP', disabled: true },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Mobile OTP' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Email' })).toHaveAttribute('aria-selected', 'true');
  });

  it('logo reads as one name', () => {
    render(<Logo />);
    expect(screen.getByLabelText('Work Trail')).toBeInTheDocument();
  });
});
