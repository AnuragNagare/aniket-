'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AutoRefresh({
  active,
  everyMs = 3000,
}: {
  active: boolean;
  everyMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      router.refresh();
    }, everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs, router]);

  return null;
}
