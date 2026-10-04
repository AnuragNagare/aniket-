'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { type ForgotPasswordInput, ForgotPasswordSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from './form-alert';
import { submitJson } from './submit-json';

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(ForgotPasswordSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    const result = await submitJson('/api/session/forgot-password', { email });
    if (result.ok) return setSentTo(email);
    setFormError(result.message);
  });

  if (sentTo) {
    return (
      <p role="status" className="rounded-input bg-brand-50 p-4 text-ink-900">
        If {sentTo} has a Work Trail account, a reset link is on its way. It expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Email address" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          icon={Mail}
          placeholder="you@company.com"
          autoComplete="email"
          {...register('email')}
        />
      </Field>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>
        Send reset link
      </Button>
    </form>
  );
}
