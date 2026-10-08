import { Card } from '@/components/ui/card';

export default function AuditSettingsPage() {
  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-ink-900">Audit log</h2>
        <p className="text-sm text-ink-500">
          Immutable log of administrative actions, data exports, and sign-ins.
        </p>
      </div>
      <p className="text-sm text-ink-500">Audit log viewer will appear here.</p>
    </Card>
  );
}
