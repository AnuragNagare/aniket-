'use client';

import { Button } from '@/components/ui/button';

export default function AppError({ retry }: { retry: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-md text-center">
      <h1 className="text-2xl">Work Trail can&apos;t load this page right now</h1>
      <p className="mt-2 text-ink-500">
        Your data is safe. Check your connection, then try again.
      </p>
      <Button className="mx-auto mt-6 max-w-[200px]" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
