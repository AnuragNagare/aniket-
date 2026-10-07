import type { AuthUser } from './auth.js';

export type MeResponse = {
  user: AuthUser;
  employee: {
    id: string;
    name: string;
    designation: string | null;
    employeeCode: string | null;
    phone: string | null;
  } | null;
  company: { name: string; timezone: string };
};
