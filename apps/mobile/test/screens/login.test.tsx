import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '../../src/api/client';
import LoginScreen from '../../src/app/(auth)/login';
import { useAuthStore } from '../../src/auth/auth-store';

describe('Login screen', () => {
  const signIn = jest.fn();
  beforeEach(() => {
    signIn.mockReset();
    useAuthStore.setState({ signIn });
  });

  async function submit(email: string, password: string) {
    fireEvent.changeText(screen.getByLabelText('Email address'), email);
    fireEvent.changeText(screen.getByLabelText('Password'), password);
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('validates before calling the server', async () => {
    render(<LoginScreen />);
    await submit('not-an-email', '');
    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in with a normalised email', async () => {
    signIn.mockResolvedValue(undefined);
    render(<LoginScreen />);
    await submit('  Amit@Demo.WorkTrail.in ', 'WorkTrail@demo1');
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('amit@demo.worktrail.in', 'WorkTrail@demo1'),
    );
  });

  it('shows the server message, including the admin redirect', async () => {
    signIn.mockRejectedValue(
      new ApiError(
        403,
        'USE_WEB_DASHBOARD',
        'This app is for field employees. Company admins sign in on the Work Trail website.',
      ),
    );
    render(<LoginScreen />);
    await submit('rahul@acme.in', 'StrongPass1');
    expect(
      await screen.findByText(
        'This app is for field employees. Company admins sign in on the Work Trail website.',
      ),
    ).toBeOnTheScreen();
  });
});
