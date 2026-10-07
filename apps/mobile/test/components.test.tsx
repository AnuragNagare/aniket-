import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '../src/components/Button';
import { Logo } from '../src/components/Logo';
import { TextField } from '../src/components/TextField';

describe('components', () => {
  it('Button is disabled and busy while loading', () => {
    const onPress = jest.fn();
    render(<Button title="Start work" loading onPress={onPress} />);
    const btn = screen.getByRole('button', { name: 'Start work' });
    expect(btn).toBeDisabled();
    expect(btn.props.accessibilityState).toMatchObject({ busy: true });
  });

  it('TextField shows its error and toggles password visibility', () => {
    render(<TextField label="Password" secureTextEntry error="Enter your password." />);
    expect(screen.getByText('Enter your password.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
  });

  it('Logo has one accessible name', () => {
    render(<Logo />);
    expect(screen.getByLabelText('Work Trail')).toBeOnTheScreen();
  });
});
