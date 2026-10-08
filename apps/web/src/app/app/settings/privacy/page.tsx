import type { CompanyDto } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RetentionForm } from '@/components/settings/retention-form';
import { serverApi } from '@/lib/server-api';
import { updateCompanyAction } from '../actions';

export default async function PrivacySettingsPage() {
  const company = await serverApi<CompanyDto>('/company');

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink-900">Data retention</h2>
        <p className="text-sm text-ink-500">
          Configure how long precise GPS location records are stored before automated nightly deletion.
        </p>
      </div>
      <RetentionForm
        initialDays={company.preciseLocationRetentionDays}
        action={updateCompanyAction}
      />
    </Card>
  );
}
