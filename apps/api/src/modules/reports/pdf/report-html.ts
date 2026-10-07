import { formatInTimeZone } from 'date-fns-tz';
import { AI_LABEL, type AdminSessionDto, type WorkUpdateDto, type PeriodSummaryDto } from '@worktrail/types';

export type ReportTotals = {
  totalMinutes: number;
  daysWorked: number;
  sessionCount: number;
  updateCount: number;
  pointCount: number;
  distanceKm: number;
  gapCount: number;
};

export type ReportEmployeeInfo = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  employeeCode: string | null;
};

export type ReportData = {
  company: { name: string; timezone: string };
  employee: ReportEmployeeInfo;
  from: string;
  to: string;
  periodLabel: string;
  generatedAt: string;
  totals: ReportTotals;
  sessions: AdminSessionDto[];
  updates: WorkUpdateDto[];
  summary: PeriodSummaryDto | null;
  notes: string[];
};

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function renderReportHtml(data: ReportData): string {
  const tz = data.company.timezone;
  const genTime = formatInTimeZone(new Date(data.generatedAt), tz, 'd MMM yyyy, h:mm a');

  const summary = data.summary;
  const hasValidSummary = summary && summary.status === 'COMPLETE' && summary.report;

  // Group updates by date string in local tz
  const updatesByDay = new Map<string, WorkUpdateDto[]>();
  for (const u of data.updates) {
    const day = formatInTimeZone(new Date(u.submittedAt), tz, 'EEE, d MMM yyyy');
    const list = updatesByDay.get(day) ?? [];
    list.push(u);
    updatesByDay.set(day, list);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Work Report - ${escapeHtml(data.employee.name)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1C1D1F;
      background: #FFFFFF;
      font-size: 13px;
      line-height: 1.5;
      padding: 24px;
    }
    .header {
      border-bottom: 2px solid #FE5A0C;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .company-name {
      font-size: 14px;
      font-weight: 600;
      color: #6E6D7A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 4px;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #1C1D1F;
    }
    .meta {
      font-size: 12px;
      color: #6E6D7A;
      text-align: right;
    }
    .period-badge {
      display: inline-block;
      background: #FAF7F2;
      border: 1px solid #ECE6DF;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      color: #1C1D1F;
      margin-top: 6px;
    }
    .section {
      margin-bottom: 28px;
    }
    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: #1C1D1F;
      border-bottom: 1px solid #ECE6DF;
      padding-bottom: 6px;
      margin-bottom: 12px;
    }
    .details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      background: #FAF7F2;
      border: 1px solid #ECE6DF;
      padding: 14px;
      border-radius: 6px;
    }
    .details-item dt {
      font-size: 11px;
      font-weight: 600;
      color: #6E6D7A;
      text-transform: uppercase;
    }
    .details-item dd {
      font-size: 13px;
      font-weight: 500;
      color: #1C1D1F;
      margin-top: 2px;
    }
    .totals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .total-card {
      border: 1px solid #ECE6DF;
      border-radius: 6px;
      padding: 10px 12px;
      background: #FFFFFF;
    }
    .total-label {
      font-size: 11px;
      color: #6E6D7A;
      font-weight: 500;
    }
    .total-val {
      font-size: 18px;
      font-weight: 700;
      color: #FE5A0C;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #6E6D7A;
      text-transform: uppercase;
      border-bottom: 1px solid #ECE6DF;
      padding: 8px 6px;
    }
    td {
      padding: 8px 6px;
      border-bottom: 1px solid #ECE6DF;
      color: #1C1D1F;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .ai-box {
      border: 1px solid #ECE6DF;
      border-radius: 6px;
      background: #FAF7F2;
      padding: 16px;
    }
    .ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .ai-badge {
      display: inline-block;
      background: #FE5A0C;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .ai-label-text {
      font-size: 11px;
      color: #6E6D7A;
    }
    .ai-overview {
      font-size: 13px;
      color: #1C1D1F;
      margin-bottom: 12px;
    }
    .ai-subheading {
      font-size: 12px;
      font-weight: 600;
      color: #1C1D1F;
      margin-top: 10px;
      margin-bottom: 4px;
    }
    .ai-list {
      margin-left: 18px;
      font-size: 12px;
      color: #1C1D1F;
    }
    .ai-list li {
      margin-bottom: 2px;
    }
    .day-group {
      margin-bottom: 18px;
    }
    .day-heading {
      font-size: 12px;
      font-weight: 700;
      color: #6E6D7A;
      text-transform: uppercase;
      padding: 4px 0;
      border-bottom: 1px solid #ECE6DF;
      margin-bottom: 8px;
    }
    .update-item {
      padding: 8px 0;
      border-bottom: 1px dashed #ECE6DF;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .update-item:last-child {
      border-bottom: none;
    }
    .update-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #6E6D7A;
      margin-bottom: 4px;
    }
    .update-time {
      font-weight: 600;
      color: #1C1D1F;
    }
    .tag {
      background: #ECE6DF;
      color: #1C1D1F;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 600;
    }
    .tag-voice {
      background: #FE5A0C;
      color: #FFFFFF;
    }
    .update-text {
      font-size: 12px;
      color: #1C1D1F;
    }
    .update-ai {
      font-size: 11px;
      color: #6E6D7A;
      margin-top: 4px;
      font-style: italic;
    }
    .footer {
      border-top: 1px solid #ECE6DF;
      padding-top: 12px;
      margin-top: 24px;
      font-size: 10px;
      color: #6E6D7A;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${escapeHtml(data.company.name)}</div>
    <div class="title-row">
      <h1 class="title">Work report</h1>
      <div class="meta">Generated: ${escapeHtml(genTime)}</div>
    </div>
    <div class="period-badge">${escapeHtml(data.periodLabel)}</div>
  </div>

  <div class="section">
    <h2 class="section-title">Employee details</h2>
    <dl class="details-grid">
      <div class="details-item">
        <dt>Name</dt>
        <dd>${escapeHtml(data.employee.name)}</dd>
      </div>
      <div class="details-item">
        <dt>Designation</dt>
        <dd>${escapeHtml(data.employee.designation ?? '—')}</dd>
      </div>
      <div class="details-item">
        <dt>Employee ID</dt>
        <dd>${escapeHtml(data.employee.employeeCode ?? data.employee.id)}</dd>
      </div>
      <div class="details-item">
        <dt>Email</dt>
        <dd>${escapeHtml(data.employee.email ?? '—')}</dd>
      </div>
      <div class="details-item">
        <dt>Phone</dt>
        <dd>${escapeHtml(data.employee.phone ?? '—')}</dd>
      </div>
    </dl>
  </div>

  <div class="section">
    <h2 class="section-title">Totals</h2>
    <div class="totals-grid">
      <div class="total-card">
        <div class="total-label">Hours worked</div>
        <div class="total-val">${formatMinutes(data.totals.totalMinutes)}</div>
      </div>
      <div class="total-card">
        <div class="total-label">Days worked</div>
        <div class="total-val">${data.totals.daysWorked}</div>
      </div>
      <div class="total-card">
        <div class="total-label">Sessions</div>
        <div class="total-val">${data.totals.sessionCount}</div>
      </div>
      <div class="total-card">
        <div class="total-label">Updates</div>
        <div class="total-val">${data.totals.updateCount}</div>
      </div>
      <div class="total-card">
        <div class="total-label">Locations recorded</div>
        <div class="total-val">${data.totals.pointCount}</div>
      </div>
      <div class="total-card">
        <div class="total-label">Distance (estimate)</div>
        <div class="total-val">${data.totals.distanceKm.toFixed(1)} km</div>
      </div>
      <div class="total-card">
        <div class="total-label">Data gaps</div>
        <div class="total-val">${data.totals.gapCount}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Sessions</h2>
    ${
      data.sessions.length === 0
        ? '<p style="color: #6E6D7A;">No sessions recorded for this period.</p>'
        : `<table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Start</th>
          <th>End</th>
          <th>Duration</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${data.sessions
          .map((s) => {
            const startStr = formatInTimeZone(new Date(s.startedAt), tz, 'EEE, d MMM yyyy');
            const startTime = formatInTimeZone(new Date(s.startedAt), tz, 'h:mm a');
            const endTime = s.endedAt ? formatInTimeZone(new Date(s.endedAt), tz, 'h:mm a') : 'In progress';
            const dur = s.totalMinutes != null ? formatMinutes(s.totalMinutes) : '—';
            return `<tr>
          <td>${escapeHtml(startStr)}</td>
          <td>${escapeHtml(startTime)}</td>
          <td>${escapeHtml(endTime)}</td>
          <td>${escapeHtml(dur)}</td>
          <td>${escapeHtml(s.status)}</td>
        </tr>`;
          })
          .join('\n        ')}
      </tbody>
    </table>`
    }
  </div>

  <div class="section">
    <h2 class="section-title">AI operational report</h2>
    <div class="ai-box">
      <div class="ai-header">
        <span class="ai-badge">AI</span>
        <span class="ai-label-text">${escapeHtml(AI_LABEL)}</span>
      </div>
      ${
        hasValidSummary
          ? `
      <p class="ai-overview">${escapeHtml(summary!.report!.overview)}</p>
      ${
        summary!.report!.keyActivities.length > 0
          ? `
      <div class="ai-subheading">Key activities</div>
      <ul class="ai-list">
        ${summary!.report!.keyActivities.map((a) => `<li>${escapeHtml(a)}</li>`).join('\n        ')}
      </ul>`
          : ''
      }
      ${
        summary!.report!.reportedIssues.length > 0
          ? `
      <div class="ai-subheading">Reported issues</div>
      <ul class="ai-list">
        ${summary!.report!.reportedIssues.map((i) => `<li>${escapeHtml(i)}</li>`).join('\n        ')}
      </ul>`
          : ''
      }
      ${
        summary!.report!.reportedFollowUps.length > 0
          ? `
      <div class="ai-subheading">Reported follow-ups</div>
      <ul class="ai-list">
        ${summary!.report!.reportedFollowUps.map((f) => `<li>${escapeHtml(f)}</li>`).join('\n        ')}
      </ul>`
          : ''
      }
      ${
        summary!.report!.dataNotes.length > 0
          ? `
      <div class="ai-subheading">Data notes</div>
      <ul class="ai-list">
        ${summary!.report!.dataNotes.map((n) => `<li>${escapeHtml(n)}</li>`).join('\n        ')}
      </ul>`
          : ''
      }`
          : '<p style="color: #6E6D7A;">Summary unavailable: the updates below are the employee&#39;s own words.</p>'
      }
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Update timeline</h2>
    ${
      data.updates.length === 0
        ? '<p style="color: #6E6D7A;">No updates submitted for this period.</p>'
        : Array.from(updatesByDay.entries())
            .map(
              ([day, items]) => `
      <div class="day-group">
        <div class="day-heading">${escapeHtml(day)}</div>
        ${items
          .map((u) => {
            const timeStr = formatInTimeZone(new Date(u.submittedAt), tz, 'h:mm a');
            const categoryTag = u.category ? `<span class="tag">${escapeHtml(u.category)}</span>` : '';
            const voiceTag = u.inputMethod === 'VOICE' ? '<span class="tag tag-voice">Voice</span>' : '';
            const aiOneLiner = u.aiSummary?.summary ? `<div class="update-ai">AI: ${escapeHtml(u.aiSummary.summary)}</div>` : '';
            return `<div class="update-item">
          <div class="update-meta">
            <span class="update-time">${escapeHtml(timeStr)}</span>
            ${categoryTag}
            ${voiceTag}
          </div>
          <div class="update-text">${escapeHtml(u.text)}</div>
          ${aiOneLiner}
        </div>`;
          })
          .join('\n        ')}
      </div>`,
            )
            .join('\n')
    }
  </div>

  <div class="footer">
    Generated by Work Trail · ${escapeHtml(AI_LABEL)}
  </div>
</body>
</html>`;
}
