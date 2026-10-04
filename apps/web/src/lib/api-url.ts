/** Absolute URL of a Work Trail API endpoint, e.g. apiUrl('/auth/login'). Server-side only. */
export const apiUrl = (path: string) =>
  `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1${path}`;
