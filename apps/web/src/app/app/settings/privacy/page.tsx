import type { CompanyDto, DeletionRequestDto } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { RetentionForm } from '@/components/settings/retention-form';
import { DeletionRequestsTable } from '@/components/settings/deletion-requests';
import { serverApi } from '@/lib/server-api';
import { updateCompanyAction } from '../actions';

export default async function PrivacySettingsPage() {
  const [company, deletionRequests] = await Promise.all([
    serverApi<CompanyDto>('/company'),
    serverApi<DeletionRequestDto[]>('/deletion-requests').catch(() => []),
  ]);

  return (
    <div className="space-y-6">
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

      <Card className="p-6 sm:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-ink-900">Employee deletion requests</h2>
          <p className="text-sm text-ink-500">
            Requests submitted by employees from the mobile app to permanently erase their data.
          </p>
        </div>
        <DeletionRequestsTable requests={deletionRequests} />
      </Card>
    </div>
  );
}
