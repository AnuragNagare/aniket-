'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Globe } from 'lucide-react';
import { type CompanyDto, type UpdateCompanyInput, UpdateCompanySchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  initial: { name: string; timezone: string };
  action: (values: UpdateCompanyInput) => Promise<MutationResult<CompanyDto>>;
};

export function CompanyForm({ initial, action }: Props) {
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCompanyInput>({
    resolver: zodResolver(UpdateCompanySchema),
    defaultValues: {
      name: initial.name,
      timezone: initial.timezone,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    setFormError(null);
    const result = await action(values);
    if (result.ok) {
      setSuccess(true);
      return;
    }
    const fields = Object.entries(result.fields);
    for (const [name, message] of fields) {
      setError(name as keyof UpdateCompanyInput, { message });
    }
    if (fields.length === 0) {
      setFormError(result.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field label="Company name" htmlFor="company-name" error={errors.name?.message}>
        <Input
          id="company-name"
          icon={Building2}
          placeholder="e.g. Acme Corp"
          {...register('name')}
        />
      </Field>

      <Field
        label="Timezone"
        htmlFor="timezone"
        error={errors.timezone?.message}
        hint="IANA timezone identifier, e.g. Asia/Kolkata"
      >
        <Input
          id="timezone"
          icon={Globe}
          placeholder="Asia/Kolkata"
          {...register('timezone')}
        />
      </Field>

      {success && (
        <p className="rounded-input bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">
          Company settings saved.
        </p>
      )}

      <FormAlert message={formError} />

      <Button type="submit" loading={isSubmitting}>
        Save changes
      </Button>
    </form>
  );
}
