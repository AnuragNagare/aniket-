import { adminPaths } from '../../src/admin/paths';

const range = { from: '2026-10-05', to: '2026-10-11' };

describe('adminPaths', () => {
  it('dashboard: optional date', () => {
    expect(adminPaths.dashboard()).toBe('/dashboard');
    expect(adminPaths.dashboard('2026-10-07')).toBe('/dashboard?date=2026-10-07');
  });

  it('employees: leaves out empty filters and encodes the search text', () => {
    expect(adminPaths.employees({})).toBe('/employees?page=1&pageSize=20');
    expect(adminPaths.employees({ query: 'amit k', status: 'WORKING', page: 2 })).toBe(
      '/employees?query=amit+k&status=WORKING&page=2&pageSize=20',
    );
    expect(adminPaths.employees({ query: '   ' })).toBe('/employees?page=1&pageSize=20');
  });

  it('employee detail, summary, sessions and trail use the period', () => {
    expect(adminPaths.employee('e1')).toBe('/employees/e1');
    expect(adminPaths.summary('e1', range)).toBe('/employees/e1/summary?from=2026-10-05&to=2026-10-11');
    expect(adminPaths.sessions('e1', range)).toBe('/employees/e1/sessions?from=2026-10-05&to=2026-10-11');
    expect(adminPaths.trail('e1', range)).toBe('/employees/e1/location-trail?from=2026-10-05&to=2026-10-11');
  });

  it('employee updates are paged', () => {
    expect(adminPaths.updates('e1', range, 2)).toBe(
      '/employees/e1/updates?from=2026-10-05&to=2026-10-11&page=2&pageSize=20',
    );
  });

  it('company sessions: period, optional status and search, paged', () => {
    expect(adminPaths.workSessions({ ...range })).toBe(
      '/work-sessions?from=2026-10-05&to=2026-10-11&page=1&pageSize=25',
    );
    expect(adminPaths.workSessions({ ...range, status: 'LEFT_RUNNING', query: 'neha', page: 3 })).toBe(
      '/work-sessions?from=2026-10-05&to=2026-10-11&page=3&pageSize=25&status=LEFT_RUNNING&query=neha',
    );
  });

  it('ids are encoded so they cannot change the route', () => {
    expect(adminPaths.employee('a/b')).toBe('/employees/a%2Fb');
  });

  it('write routes', () => {
    expect(adminPaths.invite).toBe('/employees/invitations');
    expect(adminPaths.resend('e1')).toBe('/employees/e1/invitations');
    expect(adminPaths.closeSession('e1', 's1')).toBe('/employees/e1/sessions/s1/close');
  });
});
