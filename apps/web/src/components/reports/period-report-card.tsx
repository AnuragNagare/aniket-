'use client';

import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { AI_LABEL, type PeriodSummaryDto } from '@worktrail/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AutoRefresh } from './auto-refresh';

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

type Props = {
  summary: PeriodSummaryDto | null;
  timezone: string;
  onCreate: (refresh: boolean) => Promise<{ ok: boolean } | void>;
};

export function PeriodReportCard({ summary, timezone, onCreate }: Props) {
  const [loading, setLoading] = useState(false);

  const handleCreate = async (refresh: boolean) => {
    setLoading(true);
    try {
      await onCreate(refresh);
    } finally {
      setLoading(false);
    }
  };

  if (!summary) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">AI operational report</h2>
        <p className="mt-2 text-sm text-ink-600">
          An AI report summarises this period&apos;s updates and work hours. It uses only what was recorded.
        </p>
        <div className="mt-4">
          <Button onClick={() => handleCreate(false)} loading={loading}>
            Create AI report
          </Button>
        </div>
      </Card>
    );
  }

  if (summary.status === 'QUEUED' || summary.status === 'PROCESSING') {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">AI operational report</h2>
        <p className="mt-3 text-sm text-ink-500" aria-live="polite">
          Creating report…
        </p>
        <AutoRefresh active />
      </Card>
    );
  }

  if (summary.status === 'FAILED' || !summary.report) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-ink-900">AI operational report</h2>
        <p className="mt-3 text-sm text-ink-600">
          Summary unavailable. The updates tab shows everything the employee wrote.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={() => handleCreate(true)} loading={loading}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const r = summary.report;
  const genTime = summary.generatedAt
    ? formatInTimeZone(new Date(summary.generatedAt), timezone, 'd MMM, h:mm a')
    : null;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">AI operational report</h2>
          <p className="text-xs text-ink-500">
            Based on {summary.sourceUpdateCount} updates and {formatMinutes(summary.sourceSessionMinutes)} of work
            {genTime ? ` · created ${genTime}` : ''}
          </p>
        </div>
        <Button variant="secondary" onClick={() => handleCreate(true)} loading={loading}>
          Create again
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        <p className="text-[15px] leading-relaxed text-ink-900">{r.overview}</p>

        {r.keyActivities.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Key activities</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-800">
              {r.keyActivities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {r.reportedIssues.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Reported issues</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-800">
              {r.reportedIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {r.reportedFollowUps.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Reported follow-ups</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-800">
              {r.reportedFollowUps.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {r.dataNotes.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Data notes</h3>
            <ul className="mt-1 list-disc pl-5 text-sm text-ink-800">
              {r.dataNotes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4 text-xs text-ink-500">
        <span className="mr-2 inline-block rounded bg-brand-50 px-1.5 py-0.5 font-bold text-[10px] text-brand-700 uppercase">
          AI
        </span>
        {AI_LABEL}
      </div>
    </Card>
  );
}
