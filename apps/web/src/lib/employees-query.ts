/** Employees page filters, kept in the URL so they survive reloads and can be shared. */
export type StatusFilter = 'ALL' | 'WORKING' | 'OFF_DUTY';
export type EmployeesQuery = { query: string; status: StatusFilter; page: number };

export const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseEmployeesQuery(sp: SearchParams): EmployeesQuery {
  const status = first(sp.status);
  const page = Number.parseInt(first(sp.page), 10);
  return {
    query: first(sp.q).trim(),
    status: status === 'WORKING' || status === 'OFF_DUTY' ? status : 'ALL',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Query string for GET /api/v1/employees. */
export function toApiSearch(q: EmployeesQuery): string {
  const p = new URLSearchParams();
  if (q.query) p.set('query', q.query);
  if (q.status !== 'ALL') p.set('status', q.status);
  p.set('page', String(q.page));
  p.set('pageSize', String(PAGE_SIZE));
  return `?${p}`;
}

/** Link to the employees page with some filters changed. Changing a filter resets the page. */
export function employeesHref(q: EmployeesQuery, patch: Partial<EmployeesQuery> = {}): string {
  const next = { ...q, ...patch };
  if (patch.status !== undefined || patch.query !== undefined) next.page = patch.page ?? 1;
  const p = new URLSearchParams();
  if (next.query) p.set('q', next.query);
  if (next.status !== 'ALL') p.set('status', next.status);
  if (next.page > 1) p.set('page', String(next.page));
  const s = p.toString();
  return s ? `/app/employees?${s}` : '/app/employees';
}
