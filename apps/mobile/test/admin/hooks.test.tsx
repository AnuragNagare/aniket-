import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiError } from '../../src/api/client';
import { useCloseSession, useEmployee, useEmployees, useInviteEmployee } from '../../src/admin/hooks';
import { api } from '../../src/api';

jest.mock('../../src/api', () => ({ api: { request: jest.fn() }, ApiError: jest.requireActual('../../src/api/client').ApiError }));
const request = jest.mocked(api.request);

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

beforeEach(() => request.mockReset());

describe('admin hooks', () => {
  it('useEmployees asks the API with the filters', async () => {
    request.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
    const { result } = renderHook(() => useEmployees({ query: 'amit', status: 'WORKING' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith('GET', '/employees?query=amit&status=WORKING&page=1&pageSize=20');
  });

  it('a 404 for another company id surfaces as an error, not data', async () => {
    request.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Employee not found.'));
    const { result } = renderHook(() => useEmployee('not-mine'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 404, message: 'Employee not found.' });
    expect(result.current.data).toBeUndefined();
  });

  it('inviting posts the form and returns the link', async () => {
    request.mockResolvedValue({ employeeId: 'e1', inviteUrl: 'https://x/invite/t', expiresAt: 'z', emailSent: false });
    const { result } = renderHook(() => useInviteEmployee(), { wrapper });
    let out: unknown;
    await act(async () => {
      out = await result.current.mutateAsync({ name: 'Ravi Kumar', email: 'ravi@acme.in', designation: undefined, employeeCode: undefined });
    });
    expect(request).toHaveBeenCalledWith('POST', '/employees/invitations', expect.objectContaining({ name: 'Ravi Kumar', email: 'ravi@acme.in' }));
    expect(out).toMatchObject({ inviteUrl: 'https://x/invite/t', emailSent: false });
  });

  it('closing a session posts the chosen end time', async () => {
    request.mockResolvedValue({ id: 's1' });
    const { result } = renderHook(() => useCloseSession(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ employeeId: 'e1', sessionId: 's1', endedAt: '2026-10-07T12:00:00.000Z' });
    });
    expect(request).toHaveBeenCalledWith('POST', '/employees/e1/sessions/s1/close', { endedAt: '2026-10-07T12:00:00.000Z' });
  });

  it('a refused close (already ended) is passed to the caller', async () => {
    request.mockRejectedValue(new ApiError(409, 'SESSION_NOT_ACTIVE', 'This work session has already ended.'));
    const { result } = renderHook(() => useCloseSession(), { wrapper });
    await expect(
      act(async () => {
        await result.current.mutateAsync({ employeeId: 'e1', sessionId: 's1', endedAt: 'x' });
      }),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_ACTIVE' });
  });
});
