import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { CrashScreen } from '../src/components/CrashScreen';
import { LastCrashNotice } from '../src/components/LastCrashNotice';
import { clearCrash, formatReport, installCrashRecorder, loadCrash, saveCrash } from '../src/debug/crash-report';

beforeEach(async () => {
  jest.restoreAllMocks();
  await clearCrash();
});

describe('crash report', () => {
  it('formats a readable report with the error and where it happened', () => {
    const r = formatReport(new TypeError('x is undefined'), 'screen error');
    expect(r).toContain('Where: screen error');
    expect(r).toContain('Error: TypeError: x is undefined');
  });

  it('accepts a non-Error value and keeps the report short enough to store', () => {
    expect(formatReport('boom', 'test')).toContain('Error: Error: boom');
    expect(formatReport(new Error('a'.repeat(5000)), 'test').length).toBeLessThanOrEqual(1800);
  });

  it('saves, loads and clears the last crash', async () => {
    await saveCrash('report');
    expect(await loadCrash()).toBe('report');
    await clearCrash();
    expect(await loadCrash()).toBeNull();
  });

  it('records an uncaught error and still calls the original handler', async () => {
    const previous = jest.fn();
    let installed: ((e: unknown, fatal?: boolean) => void) | undefined;
    (globalThis as any).ErrorUtils = { getGlobalHandler: () => previous, setGlobalHandler: (h: typeof installed) => void (installed = h) };
    installCrashRecorder();
    installed!(new Error('native module missing'), true);
    expect(previous).toHaveBeenCalled();
    await waitFor(async () => expect(await loadCrash()).toContain('native module missing'));
    delete (globalThis as any).ErrorUtils;
  });
});

describe('error screens', () => {
  it('the crash screen shows the error, shares it and can retry', () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    const retry = jest.fn();
    render(<CrashScreen error={new Error('map failed')} retry={retry} />);
    expect(screen.getByText(/map failed/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Copy or share error' }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('map failed') });
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('shows the last crash once and dismisses it', async () => {
    await saveCrash('Error: earlier problem');
    render(<LastCrashNotice />);
    expect(await screen.findByText(/earlier problem/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText(/earlier problem/)).toBeNull());
    expect(await loadCrash()).toBeNull();
  });

  it('shows nothing when there was no crash', () => {
    render(<LastCrashNotice />);
    expect(screen.queryByText(/last time/)).toBeNull();
  });
});
