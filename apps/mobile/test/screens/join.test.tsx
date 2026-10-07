import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import JoinScreen from '../../src/app/(auth)/join';
import { useAuthStore } from '../../src/auth/auth-store';

const T = 'KPCJwGEbnzgh2-WdirU_MssvgWChJLBPYVqFlKTWAOM';
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

describe('Join screen', () => {
  const acceptInvite = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    acceptInvite.mockReset();
    useAuthStore.setState({ acceptInvite });
  });

  it('looks up the invite from a pasted WhatsApp message, then joins', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          companyName: 'Demo Field Services Pvt Ltd',
          employeeName: 'Ravi Kumar',
          email: 'ravi@example.com',
          expiresAt: '2026-10-12T00:00:00Z',
        }),
      ),
    );
    acceptInvite.mockResolvedValue(undefined);
    render(<JoinScreen />);
    fireEvent.changeText(
      screen.getByLabelText('Invite link'),
      `Set your password here: http://192.168.1.108:3000/invite/${T}`,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Join Demo Field Services Pvt Ltd')).toBeOnTheScreen();
    expect(screen.getByLabelText('Your name').props.value).toBe('Ravi Kumar');
    fireEvent.changeText(screen.getByLabelText('Create a password'), 'StrongPass1');
    fireEvent.press(screen.getByRole('button', { name: 'Join and sign in' }));
    await waitFor(() => expect(acceptInvite).toHaveBeenCalledWith(T, 'Ravi Kumar', 'StrongPass1'));
  });

  it('explains a used or expired link', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVITE_INVALID',
            message:
              'This invite link has expired or was already used. Ask your admin for a new one.',
            details: {},
          },
        }),
        { status: 410 },
      ),
    );
    render(<JoinScreen />);
    fireEvent.changeText(screen.getByLabelText('Invite link'), T);
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText(
        'This invite link has expired or was already used. Ask your admin for a new one.',
      ),
    ).toBeOnTheScreen();
  });

  it('asks for a real link when nothing usable was pasted', async () => {
    render(<JoinScreen />);
    fireEvent.changeText(screen.getByLabelText('Invite link'), 'hello');
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Paste the full invite link your admin sent you.'),
    ).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
