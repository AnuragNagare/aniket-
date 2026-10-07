import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UpdateScreen from '../../src/app/(app)/update';
import { mockRouter } from '../mocks/expo-router';
import { emitSpeech } from '../mocks/speech';
import { setOutboxForTests, setUpdateQueueForTests } from '../../src/tracking/store';
import { ACTIVE_SESSION_KEY } from '../../src/sessions/use-work-session';
import { MemoryOutbox, MemoryUpdateQueue } from '../fakes/memory-outbox';

jest.mock('../../src/tracking/uploader', () => ({ syncNow: jest.fn(async () => undefined) }));
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

let queue: MemoryUpdateQueue;
function renderScreen() {
  const qc = new QueryClient();
  qc.setQueryData(ACTIVE_SESSION_KEY, {
    session: { id: '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f', status: 'ACTIVE', startedAt: new Date().toISOString(), endedAt: null, totalMinutes: null, lastLocationAt: null },
    offsetMs: 0,
  });
  return render(<QueryClientProvider client={qc}><UpdateScreen /></QueryClientProvider>);
}

beforeEach(() => {
  fetchMock.mockReset();
  mockRouter.replace.mockReset();
  queue = new MemoryUpdateQueue();
  setUpdateQueueForTests(queue);
  setOutboxForTests(new MemoryOutbox());
});

describe('Add update', () => {
  it('needs at least 5 characters before sending', async () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'ok');
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    expect(await screen.findByText('Write at least 5 characters.')).toBeOnTheScreen();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a typed update with a category and goes back home', async () => {
    fetchMock.mockReturnValueOnce(json({ update: {}, duplicate: false }, 201));
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Completed installation at Sai Kripa Clinic.');
    fireEvent.press(screen.getByRole('button', { name: 'Installation' }));
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/?note=sent'));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ inputMethod: 'TYPED', category: 'INSTALLATION', text: 'Completed installation at Sai Kripa Clinic.' });
  });

  it('marks the update as VOICE when dictated text was used, and keeps it editable', async () => {
    fetchMock.mockReturnValueOnce(json({ update: {}, duplicate: false }, 201));
    renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Speak your update' }));
    await waitFor(() => emitSpeech('result', { isFinal: true, results: [{ transcript: 'reached the warehouse and checked stock' }] }));
    expect(screen.getByLabelText('Your update').props.value).toBe('Reached the warehouse and checked stock');
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Reached the Andheri warehouse and checked stock');
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({ inputMethod: 'VOICE', text: 'Reached the Andheri warehouse and checked stock' });
  });

  it('with no signal, saves the update on the phone and says so', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Follow-up call with Mehta Hardware done.');
    fireEvent.press(screen.getByRole('button', { name: 'Send update' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/?note=queued'));
    expect(await queue.count()).toBe(1);
  });

  it('shows the character count', () => {
    renderScreen();
    fireEvent.changeText(screen.getByLabelText('Your update'), 'Hello there');
    expect(screen.getByText('11 / 2000')).toBeOnTheScreen();
  });
});
