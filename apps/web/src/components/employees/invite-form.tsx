'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { BadgeCheck, Briefcase, Mail, Smartphone, User } from 'lucide-react';
import { type InvitationCreated, InviteEmployeeSchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';
import { InviteLinkPanel } from './invite-link-panel';

type FormIn = z.input<typeof InviteEmployeeSchema>;
type FormOut = z.output<typeof InviteEmployeeSchema>;
type Props = { action: (values: FormOut) => Promise<MutationResult<InvitationCreated>> };

export function InviteForm({ action }: Props) {
  const [created, setCreated] = useState<{ invitation: InvitationCreated; name: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(InviteEmployeeSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await action(values);
    if (result.ok) return setCreated({ invitation: result.data, name: values.name });
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) setError(name as keyof FormIn, { message });
    if (fields.length === 0) setFormError(result.message);
  });

  if (created) return <InviteLinkPanel invitation={created.invitation} name={created.name} />;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Full name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" icon={User} placeholder="e.g. Ravi Kumar" autoComplete="off" {...register('name')} />
      </Field>
      <Field
        label="Email address"
        htmlFor="email"
        error={errors.email?.message}
        hint="They sign in to the Work Trail app with this email"
      >
        <Input
          id="email"
          type="email"
          icon={Mail}
          placeholder="ravi@example.com"
          autoComplete="off"
          {...register('email')}
        />
      </Field>
      <Field label="Mobile number (optional)" htmlFor="phone" error={errors.phone?.message}>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          icon={Smartphone}
          prefix="+91"
          placeholder="Enter mobile number"
          {...register('phone')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Designation (optional)" htmlFor="designation" error={errors.designation?.message}>
          <Input id="designation" icon={Briefcase} placeholder="e.g. Field Technician" {...register('designation')} />
        </Field>
        <Field label="Employee ID (optional)" htmlFor="employeeCode" error={errors.employeeCode?.message}>
          <Input id="employeeCode" icon={BadgeCheck} placeholder="e.g. FT-101" {...register('employeeCode')} />
        </Field>
      </div>
      <FormAlert message={formError} />
      <Button type="submit" trailingArrow loading={isSubmitting}>
        Send invite
      </Button>
    </form>
  );
}
