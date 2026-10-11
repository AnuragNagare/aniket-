import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ApiError } from '../../src/api/client';
import { QueryGate } from '../../src/components/admin/QueryGate';

const base = { isLoading: false, isError: false, error: null, refetch: jest.fn() };

describe('QueryGate', () => {
  beforeEach(() => base.refetch.mockClear());

  it('shows a loading state, not a blank screen', () => {
    render(<QueryGate query={{ ...base, isLoading: true }}><Text>data</Text></QueryGate>);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    expect(screen.queryByText('data')).toBeNull();
  });

  it('shows the server message with a retry button', () => {
    const error = new ApiError(404, 'NOT_FOUND', 'Employee not found.');
    render(<QueryGate query={{ ...base, isError: true, error }}><Text>data</Text></QueryGate>);
    expect(screen.getByText('Employee not found.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(base.refetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to a plain message for unknown errors', () => {
    render(<QueryGate query={{ ...base, isError: true, error: new Error('boom') }}><Text>data</Text></QueryGate>);
    expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen();
  });

  it('renders the content once loaded', () => {
    render(<QueryGate query={base}><Text>data</Text></QueryGate>);
    expect(screen.getByText('data')).toBeOnTheScreen();
  });
});
