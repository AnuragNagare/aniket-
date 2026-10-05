'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Smartphone, User } from 'lucide-react';
import {
  type AcceptInvitationInput,
  AcceptInvitationSchema,
  type InvitationPreview,
} from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { submitJson } from './submit-json';

type Props = { token: string; preview: InvitationPreview };
type Joined = { name: string; email: string };

export function AcceptInviteForm({ token, preview }: Props) {
  const [joined, setJoined] = useState<Joined | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AcceptInvitationInput>({
    resolver: zodResolver(AcceptInvitationSchema),
    defaultValues: { name: preview.employeeName },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitJson<{ user: Joined }>('/api/session/accept-invite', {
      token,
      ...values,
    });
    if (result.ok) return setJoined(result.data.user);
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) setError(name as keyof AcceptInvitationInput, { message });
    if (fields.length === 0) setFormError(result.message);
  });

  if (joined) {
    return (
      <div className="space-y-3">
        <h1 className="text-[32px] leading-[1.15]">You&apos;re in, {joined.name}</h1>
        <p className="flex gap-3 rounded-input bg-brand-50 p-4 text-ink-900">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden />
          <span>
            Install Work Trail on your Android phone, then sign in on the Work Trail app with{' '}
            {joined.email} and the password you just created.
          </span>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-[32px] leading-[1.15]">Join {preview.companyName}</h1>
      <p className="mb-8 mt-1 text-ink-500">
        Set a password for {preview.email}. You&apos;ll use it to sign in on the Work Trail app.
      </p>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Your name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" icon={User} autoComplete="name" {...register('name')} />
        </Field>
        <Field
          label="Create a password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 8 characters"
        >
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <FormAlert message={formError} />
        <Button type="submit" trailingArrow loading={isSubmitting}>
          Join {preview.companyName}
        </Button>
      </form>
    </>
  );
}
