import type { AuditLogsResponse, CompanyDto } from '@worktrail/types';
import { Card } from '@/components/ui/card';
import { AuditTable } from '@/components/settings/audit-table';
import { serverApi } from '@/lib/server-api';

export default async function AuditSettingsPage() {
  const [auditData, company] = await Promise.all([
    serverApi<AuditLogsResponse>('/audit-logs'),
    serverApi<CompanyDto>('/company'),
  ]);

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink-900">Audit log</h2>
        <p className="text-sm text-ink-500">
          Immutable log of administrative actions, data exports, settings changes, and sign-ins.
        </p>
      </div>
      <AuditTable items={auditData.items} timezone={company.timezone} />
    </Card>
  );
}
