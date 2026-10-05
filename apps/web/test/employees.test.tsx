import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EmployeeListItem } from '@worktrail/types';
import { EmployeeTable } from '@/components/employees/employee-table';
import { Pagination } from '@/components/employees/pagination';

const base: EmployeeListItem = {
  id: '1',
  name: 'Amit Kumar',
  designation: 'Field Sales',
  employeeCode: 'FT-101',
  email: 'amit@x.in',
  status: 'WORKING',
  account: 'ACTIVE',
};

describe('EmployeeTable', () => {
  it('shows one clear status per person', () => {
    render(
      <EmployeeTable
        items={[
          base,
          { ...base, id: '2', name: 'Neha Patel', status: 'OFF_DUTY' },
          { ...base, id: '3', name: 'Ravi Kumar', status: 'OFF_DUTY', account: 'INVITED' },
        ]}
      />,
    );
    const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) });
    expect(within(row('Amit Kumar')).getByText('Working')).toBeInTheDocument();
    expect(within(row('Neha Patel')).getByText('Off duty')).toBeInTheDocument();
    expect(within(row('Ravi Kumar')).getByText('Invite pending')).toBeInTheDocument();
  });

  it('renders the row action only for pending invites', () => {
    render(
      <EmployeeTable
        items={[base, { ...base, id: '3', name: 'Ravi Kumar', account: 'INVITED' }]}
        pendingAction={(e) => <button type="button">Resend {e.name}</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Resend Ravi Kumar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend Amit Kumar' })).toBeNull();
  });

  it('offers no invite link for someone without an email, and says why', () => {
    render(
      <EmployeeTable
        items={[{ ...base, id: '4', name: 'No Email', email: null, account: 'INVITED' }]}
        pendingAction={(e) => <button type="button">Resend {e.name}</button>}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Resend No Email' })).toBeNull();
    expect(screen.getByText('Needs an email to invite')).toBeInTheDocument();
  });

  it('invites action when the team is empty', () => {
    render(<EmployeeTable items={[]} />);
    expect(
      screen.getByText('No employees yet. Invite your first employee to start tracking work sessions.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invite employee' })).toHaveAttribute(
      'href',
      '/app/employees/new',
    );
  });

  it('says when a search matched no one, instead of the first-run message', () => {
    render(<EmployeeTable items={[]} filtered />);
    expect(screen.getByText('No employees match this search.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/app/employees',
    );
  });
});

describe('Pagination', () => {
  it('shows the range and only the links that lead somewhere', () => {
    render(<Pagination query={{ query: '', status: 'ALL', page: 1 }} pageSize={20} total={45} />);
    expect(screen.getByText('1–20 of 45')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Previous page' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute(
      'href',
      '/app/employees?page=2',
    );
  });
});
