import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminSessionDto,
  DashboardResponse,
  DateRange,
  EmployeeDetail,
  EmployeeListResponse,
  EmployeeSessionsResponse,
  EmployeeStatus,
  EmployeeSummary,
  EmployeeUpdatesResponse,
  InvitationCreated,
  InviteEmployeeInput,
  LocationTrailResponse,
  WorkSessionsResponse,
} from '@worktrail/types';
import { api } from '../api';
import { adminPaths } from './paths';

const get = <T,>(path: string) => api.request<T>('GET', path);

export const useDashboard = (date?: string) =>
  useQuery({ queryKey: ['admin', 'dashboard', date ?? 'today'], queryFn: () => get<DashboardResponse>(adminPaths.dashboard(date)) });

export const useEmployees = (q: { query?: string; status?: EmployeeStatus; page?: number }) =>
  useQuery({ queryKey: ['admin', 'employees', q], queryFn: () => get<EmployeeListResponse>(adminPaths.employees(q)) });

export const useEmployee = (id: string) =>
  useQuery({ queryKey: ['admin', 'employee', id], queryFn: () => get<EmployeeDetail>(adminPaths.employee(id)) });

export const useEmployeeSummary = (id: string, r: DateRange) =>
  useQuery({ queryKey: ['admin', 'summary', id, r], queryFn: () => get<EmployeeSummary>(adminPaths.summary(id, r)) });

export const useEmployeeSessions = (id: string, r: DateRange) =>
  useQuery({ queryKey: ['admin', 'sessions', id, r], queryFn: () => get<EmployeeSessionsResponse>(adminPaths.sessions(id, r)) });

export const useEmployeeUpdates = (id: string, r: DateRange, page = 1) =>
  useQuery({ queryKey: ['admin', 'updates', id, r, page], queryFn: () => get<EmployeeUpdatesResponse>(adminPaths.updates(id, r, page)) });

export const useEmployeeTrail = (id: string, r: DateRange, enabled = true) =>
  useQuery({ queryKey: ['admin', 'trail', id, r], queryFn: () => get<LocationTrailResponse>(adminPaths.trail(id, r)), enabled });

export const useWorkSessions = (q: DateRange & { status?: string; query?: string; page?: number }) =>
  useQuery({ queryKey: ['admin', 'work-sessions', q], queryFn: () => get<WorkSessionsResponse>(adminPaths.workSessions(q)) });

/** Invites a new employee. The employee list is refreshed afterwards. */
export function useInviteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteEmployeeInput) => api.request<InvitationCreated>('POST', adminPaths.invite, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'employees'] }),
  });
}

/** Sends a fresh link; the previous one stops working. */
export const useResendInvite = () =>
  useMutation({ mutationFn: (employeeId: string) => api.request<InvitationCreated>('POST', adminPaths.resend(employeeId), {}) });

/** Ends a forgotten session at the chosen time (audited on the server). */
export function useCloseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { employeeId: string; sessionId: string; endedAt: string }) =>
      api.request<AdminSessionDto>('POST', adminPaths.closeSession(v.employeeId, v.sessionId), { endedAt: v.endedAt }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}
