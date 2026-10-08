'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail, Smartphone, User } from 'lucide-react';
import {
  type AccountDto,
  type ChangePasswordInput,
  ChangePasswordSchema,
  type UpdateAccountInput,
  UpdateAccountSchema,
} from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  user: { name: string; email: string; phone?: string | null };
  updateAccountAction: (values: UpdateAccountInput) => Promise<MutationResult<AccountDto>>;
  changePasswordAction: (values: ChangePasswordInput) => Promise<MutationResult<{ ok: boolean }>>;
};

export function AccountForm({ user, updateAccountAction, changePasswordAction }: Props) {
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<UpdateAccountInput>({
    resolver: zodResolver(UpdateAccountSchema),
    defaultValues: {
      name: user.name,
      phone: user.phone ?? '',
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      current: '',
      next: '',
    },
  });

  const onProfileSubmit = profileForm.handleSubmit(async (values) => {
    setProfileSuccess(false);
    setProfileError(null);
    const result = await updateAccountAction(values);
    if (result.ok) {
      setProfileSuccess(true);
      return;
    }
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) {
      profileForm.setError(name as keyof UpdateAccountInput, { message });
    }
    if (fields.length === 0) {
      setProfileError(result.message);
    }
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordSuccess(false);
    setPasswordError(null);
    const result = await changePasswordAction(values);
    if (result.ok) {
      setPasswordSuccess(true);
      passwordForm.reset();
      return;
    }
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) {
      passwordForm.setError(name as keyof ChangePasswordInput, { message });
    }
    if (fields.length === 0) {
      setPasswordError(result.message);
    }
  });

  return (
    <div className="space-y-8 divide-y divide-line">
      <form onSubmit={onProfileSubmit} noValidate className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Profile details</h2>
          <p className="text-sm text-ink-500">Your personal details on Work Trail.</p>
        </div>

        <Field
          label="Full name"
          htmlFor="account-name"
          error={profileForm.formState.errors.name?.message}
        >
          <Input id="account-name" icon={User} placeholder="Your name" {...profileForm.register('name')} />
        </Field>

        <Field label="Email address" htmlFor="account-email" hint="Email cannot be changed directly.">
          <Input id="account-email" type="email" icon={Mail} value={user.email} disabled />
        </Field>

        <Field
          label="Phone number (optional)"
          htmlFor="account-phone"
          error={profileForm.formState.errors.phone?.message}
        >
          <Input
            id="account-phone"
            type="tel"
            icon={Smartphone}
            placeholder="e.g. +91 98765 43210"
            {...profileForm.register('phone')}
          />
        </Field>

        {profileSuccess && (
          <p className="rounded-input bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">
            Profile updated successfully.
          </p>
        )}

        <FormAlert message={profileError} />

        <Button type="submit" loading={profileForm.formState.isSubmitting}>
          Save profile
        </Button>
      </form>

      <form onSubmit={onPasswordSubmit} noValidate className="space-y-4 pt-8">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Change password</h2>
          <p className="text-sm text-ink-500">
            Updating your password will sign you out of all other sessions.
          </p>
        </div>

        <Field
          label="Current password"
          htmlFor="current-password"
          error={passwordForm.formState.errors.current?.message}
        >
          <Input
            id="current-password"
            type="password"
            icon={KeyRound}
            placeholder="Enter current password"
            {...passwordForm.register('current')}
          />
        </Field>

        <Field
          label="New password"
          htmlFor="next-password"
          error={passwordForm.formState.errors.next?.message}
          hint="At least 8 characters"
        >
          <Input
            id="next-password"
            type="password"
            icon={KeyRound}
            placeholder="Enter new password"
            {...passwordForm.register('next')}
          />
        </Field>

        {passwordSuccess && (
          <p className="rounded-input bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">
            Password changed successfully. All other sessions have been signed out.
          </p>
        )}

        <FormAlert message={passwordError} />

        <Button type="submit" loading={passwordForm.formState.isSubmitting}>
          Change password
        </Button>
      </form>
    </div>
  );
}
