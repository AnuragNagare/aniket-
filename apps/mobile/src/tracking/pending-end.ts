import type { EndSessionInput } from '@worktrail/types';
import { getOutbox } from './store';

/** An End work tapped with no signal, waiting to be sent. */
export type PendingEnd = { sessionId: string; body: EndSessionInput };

export async function savePendingEnd(p: PendingEnd) {
  await (await getOutbox()).setMeta('pendingEnd', JSON.stringify(p));
}

export async function readPendingEnd(): Promise<PendingEnd | null> {
  const raw = await (await getOutbox()).getMeta('pendingEnd');
  return raw ? (JSON.parse(raw) as PendingEnd) : null;
}

export async function clearPendingEnd() {
  await (await getOutbox()).setMeta('pendingEnd', null);
}
