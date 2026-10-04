'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail } from 'lucide-react';
import { type LoginInput, LoginSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { submitJson } from './submit-json';

export function LoginForm() {
  const router = useRouter();
  const [remember, setRemember] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitJson('/api/session/login', { ...values, remember });
    if (result.ok) return router.replace('/app/dashboard');
    setFormError(result.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <SegmentedTabs
        label="Sign-in method"
        value="email"
        onChange={() => undefined}
        options={[
          { value: 'email', label: 'Email' },
          {
            value: 'otp',
            label: 'Mobile OTP',
            disabled: true,
            title: 'Sign-in with a mobile OTP is coming after launch',
          },
        ]}
      />
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
      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          {...register('password')}
        />
      </Field>
      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex cursor-pointer items-center gap-2 text-ink-700">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-brand-500"
          />
          Remember me
        </label>
        <a href="/forgot-password" className="font-medium text-brand-700 hover:underline">
          Forgot password?
        </a>
      </div>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>
        Sign in
      </Button>
    </form>
  );
}
