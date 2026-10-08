import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PermissionsScreen from '../src/app/(app)/permissions';
import HomeScreen from '../src/app/(app)/index';
import * as location from '../src/location/location';
import { useAuthStore } from '../src/auth/auth-store';
import { mockRouter } from './mocks/expo-router';
import { setOutboxForTests } from '../src/tracking/store';
import { MemoryOutbox } from './fakes/memory-outbox';
import { PRIVACY_NOTICE_VERSION } from '@worktrail/types';

import * as tracking from '../src/tracking/tracking';

jest.mock('../src/location/location');
jest.mock('../src/tracking/tracking');
jest.mock('../src/tracking/uploader');
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '1.0.0',
}));
jest.mock('expo-device', () => ({
  modelName: 'Pixel 8',
}));

const loc = location as jest.Mocked<typeof location>;
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const mockNotice = {
  version: PRIVACY_NOTICE_VERSION,
  title: 'Work Trail Privacy Notice',
  retentionDays: 90,
  sections: [
    { heading: 'What we collect', body: 'Location about every 5 minutes.' },
    { heading: 'When', body: 'Only between Start work and End work.' },
    { heading: 'Why', body: 'For work hours and routes.' },
    { heading: 'Who can see it', body: 'Admins of Demo Co.' },
    { heading: 'How long', body: 'Precise locations are deleted after 90 days.' },
    { heading: 'Your choices', body: 'Tap End work at any time to stop.' },
  ],
};

const meResponse = {
  user: {
    id: 'u1',
    role: 'EMPLOYEE',
    companyId: 'c1',
    name: 'Amit Kumar',
    email: 'amit@demo.worktrail.in',
  },
  employee: {
    id: 'e1',
    name: 'Amit Kumar',
    designation: 'Field Sales Executive',
    employeeCode: 'FT-101',
    phone: null,
  },
  company: { name: 'Demo Field Services Pvt Ltd', timezone: 'Asia/Kolkata' },
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('Privacy Notice and Consent (Mobile)', () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    mockRouter.push.mockReset();
    mockRouter.replace.mockReset();
    mockRouter.back.mockReset();
    jest.mocked(tracking.startTracking).mockResolvedValue('background');
    jest.mocked(tracking.reconcileTracking).mockResolvedValue();
    jest.mocked(tracking.stopTracking).mockResolvedValue();
    jest.mocked(tracking.getTrackingStatus).mockResolvedValue({
      mode: 'background',
      pending: 0,
      lastSentAt: null,
      pendingEnd: false,
    });
    useAuthStore.setState({
      status: 'signedIn',
      accessToken: 'tok',
      user: {
        id: 'u1',
        role: 'EMPLOYEE',
        companyId: 'c1',
        name: 'Amit Kumar',
        email: 'amit@demo.worktrail.in',
      },
    });
    setOutboxForTests(new MemoryOutbox());
  });

  it('shows privacy notice first in permissions flow and includes retention number', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/privacy/notice')) return json(mockNotice);
      return json({}, 404);
    });

    renderWithClient(<PermissionsScreen />);

    // Wait for notice to load
    expect(await screen.findByText('Work Trail Privacy Notice')).toBeOnTheScreen();
    // Retention number appears in text
    expect(screen.getByText('Location data is retained for 90 days.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'I understand and agree' })).toBeOnTheScreen();
  });

  it('posts consent and moves to location permission step on agreement', async () => {
    let consentPosted = false;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/privacy/notice')) return json(mockNotice);
      if (url.endsWith('/me/consent') && init?.method === 'POST') {
        consentPosted = true;
        const parsed = JSON.parse(init.body as string);
        expect(parsed.version).toBe(PRIVACY_NOTICE_VERSION);
        expect(parsed.appVersion).toBe('1.0.0');
        expect(parsed.deviceModel).toBe('Pixel 8');
        return json({ version: PRIVACY_NOTICE_VERSION, acceptedAt: new Date().toISOString() }, 201);
      }
      return json({}, 404);
    });

    loc.requestPermission.mockResolvedValue('granted');

    renderWithClient(<PermissionsScreen />);

    expect(await screen.findByText('Work Trail Privacy Notice')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'I understand and agree' }));

    // Now moves to location step
    expect(await screen.findByText('How Work Trail uses your location')).toBeOnTheScreen();
    expect(consentPosted).toBe(true);
  });

  it('routes to privacy notice when Start work returns 409 CONSENT_REQUIRED', async () => {
    loc.currentFix.mockResolvedValue({
      ok: true,
      fix: {
        clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
        latitude: 19.07,
        longitude: 72.87,
        accuracyMeters: 10,
        capturedAt: new Date().toISOString(),
        batteryLevel: 0.8,
      },
    });

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/me')) return json(meResponse);
      if (url.endsWith('/sessions/me/active')) return json({ session: null, serverTime: new Date().toISOString() });
      if (url.endsWith('/sessions/start') && init?.method === 'POST') {
        return json({ error: { code: 'CONSENT_REQUIRED', message: 'Consent required' } }, 409);
      }
      return json({});
    });

    renderWithClient(<HomeScreen />);

    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Start work' }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith('/permissions?step=notice');
    });
  });
});
