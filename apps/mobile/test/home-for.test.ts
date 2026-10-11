import { homeFor } from '../src/auth/home-for';

describe('homeFor', () => {
  it('sends an employee to the employee area', () => expect(homeFor('EMPLOYEE')).toBe('employee'));
  it('sends an owner and an admin to the admin area', () => {
    expect(homeFor('OWNER')).toBe('admin');
    expect(homeFor('ADMIN')).toBe('admin');
  });
  it('sends nobody anywhere when there is no signed-in user', () => expect(homeFor(null)).toBeNull());
});
