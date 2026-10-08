'use client';

import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
  retry,
}: {
  error?: Error & { digest?: string };
  reset?: () => void;
  retry?: () => void;
}) {
  const onRetry = reset ?? retry ?? (() => window.location.reload());
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-2xl font-bold text-ink-900">Work Trail can&apos;t load this page right now</h1>
      <p className="mt-2 text-ink-500">
        Your data is safe. Check your connection, then try again.
      </p>
      {error?.digest ? (
        <p className="mt-2 text-xs text-ink-400 font-mono">
          Reference: {error.digest}
        </p>
      ) : null}
      <Button className="mx-auto mt-6 max-w-[200px]" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
