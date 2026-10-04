/** What a Server Action hands back to a form: data, or an error the form can show. */
export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fields: Record<string, string> };
