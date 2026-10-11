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

  it('shows the server message when sign-in fails', async () => {
    signIn.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'));
    render(<LoginScreen />);
    await submit('rahul@acme.in', 'WrongPass1');
    expect(await screen.findByText('Email or password is incorrect.')).toBeOnTheScreen();
  });
});
