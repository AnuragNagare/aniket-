import { describe, expect, it } from 'vitest';
import { employeesHref, parseEmployeesQuery, toApiSearch } from '@/lib/employees-query';

describe('employees query', () => {
  it('parses and cleans search params', () => {
    expect(parseEmployeesQuery({ q: '  ravi ', status: 'WORKING', page: '3' })).toEqual({
      query: 'ravi',
      status: 'WORKING',
      page: 3,
    });
    expect(parseEmployeesQuery({ status: 'nope', page: '-2' })).toEqual({
      query: '',
      status: 'ALL',
      page: 1,
    });
    expect(parseEmployeesQuery({ q: ['a', 'b'] }).query).toBe('a');
  });

  it('builds the API search string, omitting defaults', () => {
    expect(toApiSearch({ query: '', status: 'ALL', page: 1 })).toBe('?page=1&pageSize=20');
    expect(toApiSearch({ query: 'ravi', status: 'OFF_DUTY', page: 2 })).toBe(
      '?query=ravi&status=OFF_DUTY&page=2&pageSize=20',
    );
  });

  it('builds page links and resets to page 1 when the filter changes', () => {
    const q = { query: 'ravi', status: 'ALL' as const, page: 4 };
    expect(employeesHref(q, { page: 5 })).toBe('/app/employees?q=ravi&page=5');
    expect(employeesHref(q, { status: 'WORKING' })).toBe('/app/employees?q=ravi&status=WORKING');
  });
});
