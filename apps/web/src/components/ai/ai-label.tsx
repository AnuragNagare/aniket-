import { AI_LABEL } from '@worktrail/types';

export function AiLabel({ compact = false, id }: { compact?: boolean; id?: string }) {
  if (compact) {
    return (
      <span
        id={id}
        title={AI_LABEL}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-500"
      >
        <span className="rounded bg-brand/10 px-1 py-0.5 font-bold text-[10px] text-brand uppercase">
          AI
        </span>
        <span>AI summary</span>
      </span>
    );
  }

  return (
    <div id={id} className="flex items-center gap-2 text-xs text-ink-500">
      <span className="rounded bg-brand/10 px-1.5 py-0.5 font-bold text-[10px] text-brand uppercase">
        AI
      </span>
      <span>{AI_LABEL}</span>
    </div>
  );
}
