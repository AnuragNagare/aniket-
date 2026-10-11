import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import RegisterScreen from '../../src/app/(auth)/register';
import { useAuthStore } from '../../src/auth/auth-store';

describe('Register screen', () => {
  const register = jest.fn();
  beforeEach(() => {
    register.mockReset();
    useAuthStore.setState({ register });
  });

  const fill = (v: Record<string, string> = {}) => {
    const f: Record<string, string> = {
      'Company name': 'Acme Services',
      'Your name': 'Rahul Shah',
      'Email address': 'Rahul@Acme.in',
      'Mobile number': '98765 43210',
      Password: 'StrongPass1',
      ...v,
    };
    for (const [label, value] of Object.entries(f)) fireEvent.changeText(screen.getByLabelText(label), value);
    fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  };

  it('asks for the company name along with the admin details', () => {
    render(<RegisterScreen />);
    for (const l of ['Company name', 'Your name', 'Email address', 'Mobile number', 'Password']) {
      expect(screen.getByLabelText(l)).toBeOnTheScreen();
    }
  });

  it('validates before calling the server', async () => {
    render(<RegisterScreen />);
    fill({ 'Company name': '', 'Email address': 'nope', Password: 'short' });
    expect(await screen.findByText('Enter your company name.')).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(register).not.toHaveBeenCalled();
  });

  it('registers with a normalised email and phone', async () => {
    register.mockResolvedValue(undefined);
    render(<RegisterScreen />);
    fill();
    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        companyName: 'Acme Services',
        name: 'Rahul Shah',
        email: 'rahul@acme.in',
        phone: '+919876543210',
        password: 'StrongPass1',
      }),
    );
  });

  it('shows the server message, for example when the email is already registered', async () => {
    register.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists. Sign in instead.'));
    render(<RegisterScreen />);
    fill();
    expect(await screen.findByText('An account with this email already exists. Sign in instead.')).toBeOnTheScreen();
  });
});
