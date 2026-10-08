import type { CompanyDto } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { CompanyForm } from '@/components/settings/company-form';
import { serverApi } from '@/lib/server-api';
import { updateCompanyAction } from './actions';

export default async function CompanySettingsPage() {
  const company = await serverApi<CompanyDto>('/company');

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink-900">Company details</h2>
        <p className="text-sm text-ink-500">
          General company information and reporting timezone.
        </p>
      </div>
      <CompanyForm
        initial={{ name: company.name, timezone: company.timezone }}
        action={updateCompanyAction}
      />
    </Card>
  );
}
