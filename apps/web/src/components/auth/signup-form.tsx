'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Building2, Mail, Smartphone, User } from 'lucide-react';
import { AdminSignupSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from './form-alert';
import { PasswordInput } from './password-input';
import { submitJson } from './submit-json';

type FormIn = z.input<typeof AdminSignupSchema>;
type FormOut = z.output<typeof AdminSignupSchema>;

export function SignupForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(AdminSignupSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitJson('/api/session/signup', values);
    if (result.ok) return router.replace('/app/dashboard');
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) setError(name as keyof FormIn, { message });
    if (fields.length === 0) setFormError(result.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Company name" htmlFor="companyName" error={errors.companyName?.message}>
        <Input
          id="companyName"
          icon={Building2}
          placeholder="Enter company name"
          autoComplete="organization"
          {...register('companyName')}
        />
      </Field>
      <Field label="Your name" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          icon={User}
          placeholder="Enter your name"
          autoComplete="name"
          {...register('name')}
        />
      </Field>
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
      <Field label="Mobile number" htmlFor="phone" error={errors.phone?.message}>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          icon={Smartphone}
          prefix="+91"
          placeholder="Enter mobile number"
          autoComplete="tel-national"
          {...register('phone')}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        error={errors.password?.message}
        hint="At least 8 characters"
      >
        <PasswordInput
          id="password"
          placeholder="Create a password"
          autoComplete="new-password"
          {...register('password')}
        />
      </Field>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting} className="mt-2">
        Create account
      </Button>
      <p className="text-center text-xs leading-relaxed text-ink-500">
        By creating an account, you agree to our{' '}
        <a href="/terms" className="font-medium text-brand-700 hover:underline">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="/privacy" className="font-medium text-brand-700 hover:underline">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
