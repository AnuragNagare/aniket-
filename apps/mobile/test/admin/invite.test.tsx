import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { ApiError } from '../../src/api/client';
import * as hooks from '../../src/admin/hooks';
import InviteScreen from '../../src/app/(admin)/employees/invite';
import { mockRouter } from '../mocks/expo-router';

jest.mock('../../src/admin/hooks');
jest.mock('../../src/admin/use-company', () => ({
  useCompanyDay: () => ({ tz: 'Asia/Kolkata', today: '2026-10-07', companyName: 'Acme Services' }),
}));

const invite = { mutateAsync: jest.fn(), isPending: false };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(hooks.useInviteEmployee).mockReturnValue(invite as never);
});

const fill = (v: Record<string, string>) => {
  for (const [label, value] of Object.entries(v)) fireEvent.changeText(screen.getByLabelText(label), value);
  fireEvent.press(screen.getByRole('button', { name: 'Create invite' }));
};

describe('Invite employee screen', () => {
  it('validates before calling the server', async () => {
    render(<InviteScreen />);
    fill({ Name: 'R', 'Email address': 'nope' });
    expect(await screen.findByText("Enter the employee's name.")).toBeOnTheScreen();
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(invite.mutateAsync).not.toHaveBeenCalled();
  });

  it('creates the invite and offers to share the link', async () => {
    invite.mutateAsync.mockResolvedValue({ employeeId: 'e9', inviteUrl: 'https://x/invite/tok', expiresAt: '2026-10-14T00:00:00.000Z', emailSent: true });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    render(<InviteScreen />);
    fill({ Name: 'Ravi Kumar', 'Email address': 'Ravi@Acme.in', 'Mobile number (optional)': '98765 43210' });
    expect(await screen.findByText('Invite created for Ravi Kumar')).toBeOnTheScreen();
    expect(invite.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ravi Kumar', email: 'ravi@acme.in', phone: '+919876543210' }),
    );
    expect(screen.getByText('We emailed the link too.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Share link' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0]![0]!.message).toContain('https://x/invite/tok');
    expect(share.mock.calls[0]![0]!.message).toContain('Acme Services');
  });

  it('says plainly when the email could not be sent, so the admin shares the link', async () => {
    invite.mutateAsync.mockResolvedValue({ employeeId: 'e9', inviteUrl: 'https://x/invite/tok', expiresAt: 'z', emailSent: false });
    render(<InviteScreen />);
    fill({ Name: 'Ravi Kumar', 'Email address': 'ravi@acme.in' });
    expect(await screen.findByText(/could not be emailed/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Share link' })).toBeOnTheScreen();
  });

  it('shows the server message, for example when the email already has an account', async () => {
    invite.mutateAsync.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'This email already has a Work Trail account. Use a different email.'));
    render(<InviteScreen />);
    fill({ Name: 'Ravi Kumar', 'Email address': 'ravi@acme.in' });
    expect(await screen.findByText('This email already has a Work Trail account. Use a different email.')).toBeOnTheScreen();
  });

  it('goes back to the list when done', async () => {
    invite.mutateAsync.mockResolvedValue({ employeeId: 'e9', inviteUrl: 'https://x/invite/tok', expiresAt: 'z', emailSent: true });
    render(<InviteScreen />);
    fill({ Name: 'Ravi Kumar', 'Email address': 'ravi@acme.in' });
    fireEvent.press(await screen.findByRole('button', { name: 'Done' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
