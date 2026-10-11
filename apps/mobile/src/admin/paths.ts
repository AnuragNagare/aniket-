import type { DateRange, EmployeeStatus } from '@worktrail/types';

const enc = encodeURIComponent;
// Built by hand: React Native's URLSearchParams has historically been incomplete on device.
const qs = (entries: Array<[string, string | number | undefined]>) =>
  entries
    .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== '')
    .map(([k, v]) => `${enc(k)}=${enc(String(v)).replace(/%20/g, '+')}`)
    .join('&');

/** Every admin endpoint the app calls, in one place. Ids are encoded; empty filters are left out. */
export const adminPaths = {
  dashboard: (date?: string) => `/dashboard${date ? `?${qs([['date', date]])}` : ''}`,

  employees: (q: { query?: string; status?: EmployeeStatus; page?: number }) =>
    `/employees?${qs([
      ['query', q.query?.trim()],
      ['status', q.status],
      ['page', q.page ?? 1],
      ['pageSize', 20],
    ])}`,

  employee: (id: string) => `/employees/${enc(id)}`,
  summary: (id: string, r: DateRange) => `/employees/${enc(id)}/summary?${qs([['from', r.from], ['to', r.to]])}`,
  sessions: (id: string, r: DateRange) => `/employees/${enc(id)}/sessions?${qs([['from', r.from], ['to', r.to]])}`,
  trail: (id: string, r: DateRange) => `/employees/${enc(id)}/location-trail?${qs([['from', r.from], ['to', r.to]])}`,
  updates: (id: string, r: DateRange, page = 1) =>
    `/employees/${enc(id)}/updates?${qs([['from', r.from], ['to', r.to], ['page', page], ['pageSize', 20]])}`,

  workSessions: (q: DateRange & { status?: string; query?: string; page?: number }) =>
    `/work-sessions?${qs([
      ['from', q.from],
      ['to', q.to],
      ['page', q.page ?? 1],
      ['pageSize', 25],
      ['status', q.status],
      ['query', q.query?.trim()],
    ])}`,

  invite: '/employees/invitations',
  resend: (id: string) => `/employees/${enc(id)}/invitations`,
  closeSession: (employeeId: string, sessionId: string) =>
    `/employees/${enc(employeeId)}/sessions/${enc(sessionId)}/close`,
} as const;
