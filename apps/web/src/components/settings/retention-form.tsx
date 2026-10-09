'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Clock } from 'lucide-react';
import { type CompanyDto, type UpdateCompanyInput, UpdateCompanySchema } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { FormAlert } from '@/components/auth/form-alert';
import type { MutationResult } from '@/lib/mutation-result';

type Props = {
  initialDays: number;
  action: (values: UpdateCompanyInput) => Promise<MutationResult<CompanyDto>>;
};

export function RetentionForm({ initialDays, action }: Props) {
  const [currentInitial, setCurrentInitial] = useState(initialDays);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateCompanyInput>({
    resolver: zodResolver(UpdateCompanySchema),
    defaultValues: {
      preciseLocationRetentionDays: initialDays,
    },
  });

  const daysValue = useWatch({ control, name: 'preciseLocationRetentionDays' });
  const isLower = typeof daysValue === 'number' && !isNaN(daysValue) && daysValue >= 30 && daysValue < currentInitial;

  const onSubmit = handleSubmit(async (values) => {
    setSuccess(false);
    setFormError(null);
    const result = await action(values);
    if (result.ok) {
      setSuccess(true);
      if (values.preciseLocationRetentionDays) {
        setCurrentInitial(values.preciseLocationRetentionDays);
      }
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
      <Field
        label="Precise location retention (days)"
        htmlFor="retention-days"
        error={errors.preciseLocationRetentionDays?.message}
        hint="Choose between 30 and 365 days. Summaries, updates, and work hours are kept."
      >
        <Input
          id="retention-days"
          type="number"
          min={30}
          max={365}
          icon={Clock}
          {...register('preciseLocationRetentionDays', { valueAsNumber: true })}
        />
      </Field>

      {isLower && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-input border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-semibold">Retention decrease warning</p>
            <p className="mt-0.5">
              Locations older than {daysValue} days will be deleted tonight. This can&apos;t be undone.
            </p>
          </div>
        </div>
      )}

      {success && (
        <p className="rounded-input bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">
          Location retention updated.
        </p>
      )}

      <FormAlert message={formError} />

      <Button type="submit" loading={isSubmitting}>
        Save changes
      </Button>
    </form>
  );
}
