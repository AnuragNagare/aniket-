'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PasswordSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { submitJson } from './submit-json';

const ResetFormSchema = z
  .object({ password: PasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'The passwords do not match.',
  });
type Values = z.infer<typeof ResetFormSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(ResetFormSchema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    const result = await submitJson('/api/session/reset-password', { token, password });
    if (result.ok) return setDone(true);
    setFormError(result.fields.password ?? result.message);
  });

  if (done) {
    return (
      <p role="status" className="rounded-input bg-brand-50 p-4 text-ink-900">
        Password saved. Sign in with your new password.{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="New password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters">
        <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
        <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} />
      </Field>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>
        Save new password
      </Button>
    </form>
  );
}
