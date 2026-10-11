import { fireEvent, render, screen } from '@testing-library/react-native';
import WelcomeScreen from '../../src/app/(auth)/welcome';
import { mockRouter } from '../mocks/expo-router';

describe('Welcome screen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('offers three clear choices, each saying who it is for', () => {
    render(<WelcomeScreen />);
    expect(screen.getByRole('button', { name: 'Get started' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Register' })).toBeOnTheScreen();
    expect(screen.getByText('I am an employee and have an invite link')).toBeOnTheScreen();
    expect(screen.getByText('Admins and returning employees')).toBeOnTheScreen();
    expect(screen.getByText('New admin: create your company account')).toBeOnTheScreen();
  });

  it('sends each button to its own screen', () => {
    render(<WelcomeScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/join');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/login');
    fireEvent.press(screen.getByRole('button', { name: 'Register' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/register');
  });
});
